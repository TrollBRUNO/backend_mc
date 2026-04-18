import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Account, AccountDocument } from '../account/account.schema';
import { Statistics, StatisticsDocument } from '../statistics/statistics.schema';
import { Wheel, WheelDocument } from './wheel.schema';
import { DemoSpin, DemoSpinDocument } from './demo-spin.schema';
import { CreateWheelDto } from './dto/create-wheel.dto';
import { UpdateWheelDto } from './dto/update-wheel.dto';

const DEMO_PRIZES = [10, 10, 10, 10, 15, 15, 20, 20, 25, 25, 40, 50, 100];

@Injectable()
export class WheelService {
  constructor(
    @InjectModel(Wheel.name) private wheelModel: Model<WheelDocument>,
    @InjectModel(Account.name) private accountModel: Model<AccountDocument>,
    @InjectModel(Statistics.name) private statModel: Model<StatisticsDocument>,
    @InjectModel(DemoSpin.name) private demoSpinModel: Model<DemoSpinDocument>,
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

    const index = Math.floor(Math.random() * wheel.length);
    const prize = wheel[index];

    const currentBonus = Number(account.bonus_balance ?? 0);
    account.bonus_balance = (currentBonus + prize) as any;
    account.last_spin_date = now;

    await account.save();

    await this.statModel.create({
      user_id: accountId,
      prize_count: prize,
      spin_date: now,
    });

    return {
      index,
      prize,
      bonus_balance: account.bonus_balance,
    };
  }

  async demoSpin(demo_id: string): Promise<{ amount: number }> {
    const existing = await this.demoSpinModel.findOne({ demo_id }).exec();
    if (existing) throw new BadRequestException('DEMO_ALREADY_USED');

    const prize = DEMO_PRIZES[Math.floor(Math.random() * DEMO_PRIZES.length)];
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

    await this.statModel.create({
      user_id: accountId,
      prize_count: demoSpin.amount,
      spin_date: now,
    });

    await this.demoSpinModel.deleteOne({ demo_id }).exec();

    return { bonus_balance: account.bonus_balance };
  }
}
