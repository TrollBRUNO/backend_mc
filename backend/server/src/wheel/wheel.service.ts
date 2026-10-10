import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Account, AccountDocument } from '../account/account.schema';
import { WheelStatsService } from '../statistics/wheel-stats.service';
import { Wheel, WheelDocument } from './wheel.schema';
import { DemoSpin, DemoSpinDocument } from './demo-spin.schema';
import { CreateWheelDto } from './dto/create-wheel.dto';
import { UpdateWheelDto } from './dto/update-wheel.dto';
import { randomItem, sameWheel, sectorsOf } from './wheel-prize.util';

@Injectable()
export class WheelService {
  constructor(
    @InjectModel(Wheel.name) private wheelModel: Model<WheelDocument>,
    @InjectModel(Account.name) private accountModel: Model<AccountDocument>,
    @InjectModel(DemoSpin.name) private demoSpinModel: Model<DemoSpinDocument>,
    private readonly wheelStats: WheelStatsService,
  ) {}

  async findAll(): Promise<Wheel[]> {
    return this.wheelModel.find().exec();
  }

  async findOne(id: string): Promise<Wheel> {
    const doc = await this.wheelModel.findById(id).exec();
    if (!doc) throw new NotFoundException(`News ${id} not found`);
    return doc;
  }  

  async create(dto: CreateWheelDto): Promise<Wheel> {
    const news = new this.wheelModel(dto);
    return news.save();
  } 

  async update(id: string, dto: UpdateWheelDto): Promise<Wheel> {
    const updated = await this.wheelModel.findByIdAndUpdate(id, dto, { new: true }).exec();
    if (!updated) throw new NotFoundException(`News ${id} not found`);
    return updated;
  }   

  async delete(id: string): Promise<Wheel> {
    const deleted = await this.wheelModel.findByIdAndDelete(id).exec();
    if (!deleted) throw new NotFoundException(`News ${id} not found`);
    return deleted;
  }   

  /* async spin(accountId: string, wheel: number[]) {
    const account = await this.accountModel.findById(accountId);
    if (!account) throw new NotFoundException('Account not found');

    const now = new Date();

    // ---------- canSpin ----------
    if (account.last_spin_date) {
      const diff = now.getTime() - account.last_spin_date.getTime();
      if (diff < 24 * 60 * 60 * 1000) {
        throw new BadRequestException('SPIN_NOT_AVAILABLE');
      }
    }

    // ---------- выбор приза ----------
    const index = Math.floor(Math.random() * wheel.length);
    const prize = wheel[index];

    // ---------- начисляем бонус ----------
    const currentBonus = Number(account.bonus_balance?.toString() ?? 0);
    account.bonus_balance = (currentBonus + prize) as any;

    // ---------- обновляем дату ----------
    account.last_spin_date = now;

    await account.save();

    // ---------- статистика ----------
    await this.statModel.create({
      user_id: accountId,
      prize_count: prize,
      spin_date: now,
    });

    return {
      index,
      prize,
      bonus_balance: account.bonus_balance,
      spin_date: now,
    };
  } */
  // Значения секторов колеса из админки — то же, что отдаёт GET /wheel
  private async wheelValues(): Promise<number[]> {
    const docs = await this.wheelModel.find().lean().exec();
    const values = docs
      .map(d => Number(d.value))
      .filter(v => Number.isFinite(v) && v > 0);
    if (values.length === 0) throw new BadRequestException('WHEEL_EMPTY');
    return values;
  }

  async spin(accountId: string, wheel: number[]) {
    const account = await this.accountModel.findById(accountId);
    if (!account) throw new NotFoundException('Account not found');

    const now = new Date();

    // ⛔ защита от прямого вызова (без проверки)
    if (account.last_spin_date) {
      const diff = now.getTime() - account.last_spin_date.getTime();
      if (diff < 24 * 60 * 60 * 1000) {
        throw new BadRequestException('SPIN_NOT_AVAILABLE');
      }
    }

    // Проверка до розыгрыша, иначе отказ по выпавшему призу позволил бы
    // крутить, пока не выпадет нужное. Колесо клиента расходится с БД, когда
    // админ поменял секторы, — приложению надо перезагрузить колесо
    const values = await this.wheelValues();
    if (!sameWheel(wheel, values)) {
      throw new BadRequestException('WHEEL_OUTDATED');
    }

    const prize = randomItem(values);
    const index = randomItem(sectorsOf(wheel, prize));

    const currentBonus = Number(account.bonus_balance ?? 0);
    account.bonus_balance = (currentBonus + prize) as any;
    account.last_spin_date = now;

    await account.save();

    await this.wheelStats.recordSpin(accountId, prize, 'spin', now);

    return {
      index,
      prize,
      bonus_balance: account.bonus_balance,
    };
  }

  async demoSpin(demo_id: string): Promise<{ amount: number }> {
    const existing = await this.demoSpinModel.findOne({ demo_id }).exec();
    if (existing) throw new BadRequestException('DEMO_ALREADY_USED');

    // Только значения с колеса: приложение ищет сектор с выпавшей суммой, и
    // при отдельном списке призов (10, 15, 20, 40) не находило его и
    // показывало первый сектор — 25, а начислялось меньше
    const prize = randomItem(await this.wheelValues());
    await this.demoSpinModel.create({ demo_id, amount: prize });

    return { amount: prize };
  }

  async getDemoStatus(demo_id: string): Promise<{ valid: boolean; amount?: number }> {
    const doc = await this.demoSpinModel.findOne({ demo_id }).exec();
    if (!doc) return { valid: false };
    return { valid: true, amount: doc.amount };
  }

  async claimDemoBonus(accountId: string, demo_id: string): Promise<{ bonus_balance: any }> {
    const demoSpin = await this.demoSpinModel.findOne({ demo_id }).exec();
    if (!demoSpin) throw new BadRequestException('DEMO_NOT_FOUND');

    const account = await this.accountModel.findById(accountId);
    if (!account) throw new NotFoundException('Account not found');

    const now = new Date();
    const currentBonus = Number(account.bonus_balance ?? 0);
    account.bonus_balance = (currentBonus + demoSpin.amount) as any;
    account.last_spin_date = now;

    await account.save();

    await this.wheelStats.recordSpin(accountId, demoSpin.amount, 'demo', now);

    await this.demoSpinModel.deleteOne({ demo_id }).exec();

    return { bonus_balance: account.bonus_balance };
  }
}
