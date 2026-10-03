import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';

import { Account, AccountDocument } from './account.schema';
import {
  IDENTITY_FIELD,
  IdentityProvider,
  VerifiedIdentity,
  countLoginMethods,
  emailFieldOf,
  isDuplicateKeyError,
  loginMethodsOf,
  validateLogin,
  validatePassword,
} from './identity.util';

// Всё, чем человек управляет во вкладке Settings: логин, пароль, привязанные
// Google, Apple и телефон, удаление аккаунта
@Injectable()
export class AccountIdentityService {
  constructor(
    @InjectModel(Account.name)
    private readonly accountModel: Model<AccountDocument>,
  ) {}

  async getSecurity(accountId: string) {
    return this.view(await this.findActive(accountId));
  }

  // Привязать Google, Apple или телефон. Чужой — отказ, аккаунты не склеиваем.
  // Свой прежний способ того же вида заменяется новым: человек только что
  // доказал, что владеет новым
  async linkIdentity(accountId: string, identity: VerifiedIdentity) {
    const account = await this.findActive(accountId);
    const field = IDENTITY_FIELD[identity.provider];

    const owner = await this.accountModel
      .findOne({ [field]: identity.subject })
      .select('_id')
      .lean();
    if (owner && String(owner._id) !== String(account._id)) {
      throw new ConflictException('IDENTITY_TAKEN');
    }

    account.set(field, identity.subject);
    const emailField = emailFieldOf(identity.provider);
    if (emailField) account.set(emailField, identity.email ?? null);

    try {
      await account.save();
    } catch (error) {
      // Тот же способ параллельно привязали к другому аккаунту
      if (isDuplicateKeyError(error)) throw new ConflictException('IDENTITY_TAKEN');
      throw error;
    }

    return this.view(account);
  }

  async unlinkIdentity(accountId: string, provider: IdentityProvider) {
    const account = await this.findActive(accountId);
    const field = IDENTITY_FIELD[provider];

    if (!account.get(field)) return this.view(account);

    // Без единого способа входа в аккаунт уже не попасть
    const remaining = { ...loginMethodsOf(account), [provider]: null };
    if (countLoginMethods(remaining) === 0) {
      throw new BadRequestException('LAST_LOGIN_METHOD');
    }

    account.set(field, null);
    const emailField = emailFieldOf(provider);
    if (emailField) account.set(emailField, null);
    await account.save();

    return this.view(account);
  }

  async changeLogin(accountId: string, rawLogin: unknown) {
    const login = validateLogin(rawLogin);
    const account = await this.findActive(accountId);

    if (login === account.login) return this.view(account);

    if (await this.accountModel.exists({ login })) {
      throw new BadRequestException('USERNAME_TAKEN');
    }

    account.login = login;
    try {
      await account.save();
    } catch (error) {
      if (isDuplicateKeyError(error)) throw new BadRequestException('USERNAME_TAKEN');
      throw error;
    }

    return this.view(account);
  }

  // Задать пароль (если его не было) или сменить. Для смены нужен текущий
  // пароль — или свежий вход через привязанный Google, Apple или телефон:
  // так работает «забыл пароль».
  // token_version не трогаем: смена пароля никого не выкидывает
  async setPassword(
    accountId: string,
    dto: {
      new_password: unknown;
      current_password?: string;
      reauth?: VerifiedIdentity | null;
    },
  ) {
    const password = validatePassword(dto.new_password);
    const account = await this.findActive(accountId);

    if (account.password) {
      const currentOk =
        !!dto.current_password &&
        (await bcrypt.compare(dto.current_password, account.password));
      const reauthOk =
        !!dto.reauth &&
        account.get(IDENTITY_FIELD[dto.reauth.provider]) === dto.reauth.subject;

      // 400, а не 401: на 401 приложение решило бы, что кончилась сессия
      if (!currentOk && !reauthOk) {
        throw new BadRequestException('WRONG_PASSWORD');
      }
    }

    account.password = await bcrypt.hash(password, 10);
    await account.save();

    return this.view(account);
  }

  // Для человека аккаунт исчезает: войти в него нельзя, а логин, Google,
  // Apple, телефон и карты свободны для новой регистрации. Запись остаётся
  // в базе для истории, прежние данные — в deleted_snapshot для админки.
  // token_version + 1 гасит все выданные токены
  async softDelete(accountId: string) {
    const account = await this.findActive(accountId);
    const now = new Date();

    await this.accountModel.updateOne(
      { _id: account._id },
      {
        $set: {
          deleted_at: now,
          deleted_snapshot: {
            login: account.login,
            realname: account.realname ?? '',
            google_id: account.google_id ?? null,
            google_email: account.google_email ?? null,
            apple_id: account.apple_id ?? null,
            apple_email: account.apple_email ?? null,
            phone: account.phone ?? null,
            cards: account.cards ?? [],
            // Нужен, чтобы на вход по старому логину ответить «аккаунт удалён»,
            // а не «неверный пароль». Админке не отдаётся
            password_hash: account.password ?? null,
          },
          login: `deleted_${account._id}`,
          password: null,
          google_id: null,
          google_email: null,
          apple_id: null,
          apple_email: null,
          phone: null,
          cards: [],
          fcm_token: null,
          bonus_code: null,
          bonus_code_expire: null,
        },
        $inc: { token_version: 1 },
      },
    );

    return { success: true };
  }

  private async findActive(accountId: string): Promise<AccountDocument> {
    const account = await this.accountModel.findById(accountId);
    if (!account || account.deleted_at) {
      throw new NotFoundException('ACCOUNT_NOT_FOUND');
    }
    return account;
  }

  private view(account: AccountDocument) {
    return {
      login: account.login,
      ...loginMethodsOf(account),
    };
  }
}
