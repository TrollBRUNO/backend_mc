import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Account, AccountDocument } from './account.schema';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';

@Injectable()
export class AccountService {
  constructor(
    @InjectModel(Account.name) private accountModel: Model<AccountDocument>,
  ) {}

  async findAll(): Promise<Account[]> {
    return this.accountModel.find().sort({ create_date: -1 }).exec();
  }

  async findOne(id: string): Promise<Account> {
    const doc = await this.accountModel.findById(id).exec();
    if (!doc) throw new NotFoundException(`Account ${id} not found`);
    return doc;
  }  

  async create(dto: CreateAccountDto): Promise<Account> {
    const account = new this.accountModel(dto);
    return account.save();
  } 

  async update(id: string, dto: UpdateAccountDto): Promise<Account> {
    const updated = await this.accountModel.findByIdAndUpdate(id, dto, { new: true }).exec();
    if (!updated) throw new NotFoundException(`Account ${id} not found`);
    return updated;
  }   

  async delete(id: string): Promise<Account> {
    const deleted = await this.accountModel.findByIdAndDelete(id).exec();
    if (!deleted) throw new NotFoundException(`Account ${id} not found`);
    return deleted;
  }   

  async generateBonusCode(accountId: string): Promise<string> {
    const account = await this.accountModel.findById(accountId);

    if (!account) {
      throw new NotFoundException('Account not found');
    }

    // генерируем 6-значный код (000000–999999)
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    account.bonus_code = code;

    // TTL: 5 минут
    account.bonus_code_expire = new Date(Date.now() + 5 * 60 * 1000);

    await account.save();

    return code;
  }

  async verifyBonusCode(
    accountId: string,
    card_id: string,
    code: string,
  ) {
    // 1. Ищем аккаунт
    const account = await this.accountModel.findById(accountId);

    if (!account) {
      throw new NotFoundException('Account not found');
    }

    // 2. Проверяем что карта принадлежит аккаунту
    const card = account.cards.find(
      c => c.card_id === card_id && c.active === true
    );

    if (!card) {
      throw new BadRequestException('This card is not linked to this account or not active');
    }

    // 3. Проверяем корректность кода
    if (!account.bonus_code || account.bonus_code !== code) {
      throw new BadRequestException('Invalid bonus code');
    }

    // 4. Проверяем срок годности
    if (!account.bonus_code_expire || account.bonus_code_expire < new Date()) {
      throw new BadRequestException('Bonus code expired');
    }

    // 5. Сбрасываем бонусный баланс полностью
    account.bonus_balance = 0 as any;

    // 6. Сбрасываем код (исправлено!)
    account.bonus_code == null;
    account.bonus_code_expire == null;

    await account.save();

    return {
      success: true,
      message: 'Bonus applied successfully',
      bonus_balance: account.bonus_balance,
    };
  }



  async bindCard(accountId: string, card_id: string, city: string) {
    // Проверка, используется ли карта
    const exists = await this.accountModel.findOne({
      "cards.card_id": card_id,
      "cards.active": true,
    });

    if (exists) {
      throw new BadRequestException(
        'This card is already linked to another account.',
      );
    }

    const account = await this.accountModel.findById(accountId);
    if (!account) throw new NotFoundException('Account not found');

    const card = {
      card_id,
      city,
      bind_date: new Date(),
      active: true,
    };

    account.cards.push(card);
    await account.save();

    return card;
  }

  async listCards(accountId: string) {
    const account = await this.accountModel.findById(accountId);
    if (!account) throw new NotFoundException('Account not found');

    return account.cards;
  }

  async removeCard(accountId: string, cardId: string) {
    const account = await this.accountModel.findById(accountId);
    if (!account) throw new NotFoundException('Account not found');

    const card = account.cards.find(c => c.card_id === cardId);
    if (!card) throw new NotFoundException('Card not found');

    card.active = false;

    await account.save();
    return card;
  }
}
