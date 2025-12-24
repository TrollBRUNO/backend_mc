import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import mongoose, { Model } from 'mongoose';
import { Account, AccountDocument } from './account.schema';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import * as bcrypt from 'bcrypt';

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

  async getProfile(accountId: string) {
    const account = await this.accountModel.findById(accountId);
    if (!account) throw new NotFoundException('Account not found');

    return {
      login: account.login,
      realname: account.realname,
      balance: account.balance,
      bonus_balance: account.bonus_balance,
      credit_balance: account.fake_balance,
      image_url: account.image_url,
      cards: account.cards,
    };
  }

  async register(dto: {
    login: string;
    password: string;
    realname: string;
    cards?: {
      card_id: string;
      city: string;
      active: boolean;
    }[];
  }) {
    // 1️⃣ username уникален
    const loginExists = await this.accountModel.findOne({
      login: dto.login,
    });

    if (loginExists) {
      throw new BadRequestException('USERNAME_TAKEN');
    }

    // 2️⃣ карта уникальна
    if (dto.cards?.length) {
      const cardId = dto.cards[0].card_id;
      await this.checkCardAvailability(cardId);
    }

    const hash = await bcrypt.hash(dto.password, 10);
    
    const account = new this.accountModel({
      login: dto.login,
      password: hash,
      realname: dto.realname,
      cards: dto.cards ?? [],
    });

    await account.save();

    return { success: true };
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
    account.bonus_code = null;
    account.bonus_code_expire = null;

    await account.save();

    return {
      success: true,
      message: 'Bonus applied successfully',
      bonus_balance: account.bonus_balance,
    };
  }

  async bindCard(accountId: string, card_id: string, city: string) {
    await this.checkCardAvailability(card_id);

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

  async checkCardAvailability(cardId: string): Promise<void> {
    const exists = await this.accountModel.findOne({
      'cards.card_id': cardId,
      'cards.active': true,
    });

    if (exists) {
      throw new BadRequestException('CARD_ALREADY_USED');
    }
  }

  /* async canSpin(accountId: string): Promise<{ canSpin: boolean; nextSpin?: Date }> {
    const account = await this.accountModel.findById(accountId);
    if (!account) throw new NotFoundException('Account not found');

    const now = new Date();
    const lastSpin = account.last_spin_date;
    const bonus = Number(account.bonus_balance?.toString() ?? 0);

    // Если бонус не забрали > 24 часа — сгорает
    if (lastSpin && account.bonus_balance && bonus > 0) {
      const diff = now.getTime() - lastSpin.getTime();
      if (diff >= 24 * 60 * 60 * 1000) {
        account.bonus_balance = 0 as any;
        await account.save();
      }
    }

    // Можно ли крутить колесо?
    if (!lastSpin) return { canSpin: true };

    const diff = now.getTime() - lastSpin.getTime();
    if (diff >= 24 * 60 * 60 * 1000) {
      return { canSpin: true };
    } else {
      return { canSpin: false, nextSpin: new Date(lastSpin.getTime() + 24 * 60 * 60 * 1000) };
    }
  } */

  async canSpin(accountId: string) {
    const account = await this.accountModel.findById(accountId);
    if (!account) throw new NotFoundException();

    if (!account.last_spin_date) {
      return { canSpin: true }; // 👈 первый раз
    }

    const diff = Date.now() - account.last_spin_date.getTime();

    if (diff >= 24 * 60 * 60 * 1000) {
      return { canSpin: true };
    }

    return {
      canSpin: false,
      nextSpin: new Date(account.last_spin_date.getTime() + 24 * 60 * 60 * 1000),
    };
  }

  //Получение fake_balance (TakeCredit/CreditTake) раз в 24 часа
  /* async canTakeCredit(accountId: string): Promise<{ canTake: boolean; nextTake?: Date }> {
    const account = await this.accountModel.findById(accountId);
    if (!account) throw new NotFoundException('Account not found');

    const lastCredit = account.last_credit_take_date; // добавить в схему поле Date | null
    const now = new Date();

    if (!lastCredit) return { canTake: true };

    const diff = now.getTime() - lastCredit.getTime();
    if (diff >= 24 * 60 * 60 * 1000) {
      return { canTake: true };
    } else {
      return { canTake: false, nextTake: new Date(lastCredit.getTime() + 24 * 60 * 60 * 1000) };
    }
  } */

  async canTakeCredit(accountId: string) {
    const account = await this.accountModel.findById(accountId);
    if (!account) throw new NotFoundException();

    if (!account.last_credit_take_date) {
      return { canTake: true }; // 👈 ПЕРВЫЙ РАЗ
    }

    const diff = Date.now() - account.last_credit_take_date.getTime();

    if (diff >= 24 * 60 * 60 * 1000) {
      return { canTake: true };
    }

    return {
      canTake: false,
      nextTake: new Date(account.last_credit_take_date.getTime() + 24 * 60 * 60 * 1000),
    };
  }

  async takeCredit(accountId: string, amount = 1000) {
    const account = await this.accountModel.findById(accountId);
    if (!account) throw new NotFoundException('Account not found');

    const now = new Date();

    if (account.last_credit_take_date) {
      const diff = now.getTime() - account.last_credit_take_date.getTime();
      if (diff < 24 * 60 * 60 * 1000) {
        throw new BadRequestException('TOO_EARLY');
      }
    }

    const currentBonus = Number(account.fake_balance ?? 0);
    account.fake_balance = (currentBonus + amount) as any;
    account.last_credit_take_date = now;

    await account.save();

    //return account;
    return {
      fake_balance: account.fake_balance,
    }
  }
}
