import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import * as bcrypt from 'bcrypt';

import { AccountIdentityService } from './account-identity.service';
import { Account } from './account.schema';

// Документ аккаунта с get/set/save, как у mongoose
function fakeAccount(fields: Record<string, any> = {}) {
  const doc: any = {
    _id: new Types.ObjectId(),
    login: 'player1',
    realname: '',
    password: null,
    google_id: null,
    google_email: null,
    apple_id: null,
    apple_email: null,
    phone: null,
    cards: [],
    deleted_at: null,
    ...fields,
  };
  doc.get = (key: string) => doc[key];
  doc.set = (key: string, value: unknown) => {
    doc[key] = value;
  };
  doc.save = jest.fn(async () => doc);
  return doc;
}

describe('AccountIdentityService', () => {
  let service: AccountIdentityService;
  let account: any;
  let owner: any;
  let accountModel: any;

  beforeEach(async () => {
    account = fakeAccount();
    owner = null;

    accountModel = {
      findById: jest.fn(async () => account),
      findOne: jest.fn(() => ({ select: () => ({ lean: async () => owner }) })),
      exists: jest.fn(async () => null),
      updateOne: jest.fn(async () => ({})),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountIdentityService,
        { provide: getModelToken(Account.name), useValue: accountModel },
      ],
    }).compile();

    service = module.get(AccountIdentityService);
  });

  const google = { provider: 'google' as const, subject: 'g-1', email: 'ivan@gmail.com' };
  const phone = { provider: 'phone' as const, subject: '+359888123456' };

  describe('linkIdentity', () => {
    it('привязывает Google вместе с почтой', async () => {
      const view = await service.linkIdentity(String(account._id), google);

      expect(account.google_id).toBe('g-1');
      expect(view.google).toEqual({ email: 'ivan@gmail.com' });
    });

    it('чужой Google — IDENTITY_TAKEN, аккаунты не склеиваем', async () => {
      owner = { _id: new Types.ObjectId() };

      await expect(service.linkIdentity(String(account._id), google)).rejects.toThrow(
        'IDENTITY_TAKEN',
      );
      expect(account.save).not.toHaveBeenCalled();
    });

    it('гонка с другим аккаунтом на уникальном индексе — тоже IDENTITY_TAKEN', async () => {
      account.save.mockRejectedValueOnce({ code: 11000 });

      await expect(service.linkIdentity(String(account._id), phone)).rejects.toThrow(
        'IDENTITY_TAKEN',
      );
    });

    it('удалённому аккаунту привязать нельзя', async () => {
      account.deleted_at = new Date();

      await expect(service.linkIdentity(String(account._id), google)).rejects.toThrow(
        'ACCOUNT_NOT_FOUND',
      );
    });
  });

  describe('unlinkIdentity', () => {
    it('последний способ входа отвязать нельзя', async () => {
      account.google_id = 'g-1';

      await expect(service.unlinkIdentity(String(account._id), 'google')).rejects.toThrow(
        'LAST_LOGIN_METHOD',
      );
    });

    it('при заданном пароле Google отвязывается', async () => {
      Object.assign(account, { password: 'hash', google_id: 'g-1', google_email: 'ivan@gmail.com' });

      const view = await service.unlinkIdentity(String(account._id), 'google');

      expect(account.google_id).toBeNull();
      expect(account.google_email).toBeNull();
      expect(view.google).toBeNull();
    });
  });

  describe('changeLogin', () => {
    it('меняет логин', async () => {
      const view = await service.changeLogin(String(account._id), 'JackpotKing13');
      expect(view.login).toBe('JackpotKing13');
    });

    it('занятый логин — USERNAME_TAKEN', async () => {
      accountModel.exists.mockResolvedValueOnce({ _id: new Types.ObjectId() });

      await expect(service.changeLogin(String(account._id), 'JackpotKing13')).rejects.toThrow(
        'USERNAME_TAKEN',
      );
    });

    it('короткий логин — INVALID_LOGIN', async () => {
      await expect(service.changeLogin(String(account._id), 'abc')).rejects.toThrow(
        'INVALID_LOGIN',
      );
    });
  });

  describe('setPassword', () => {
    it('аккаунт без пароля задаёт его без текущего', async () => {
      await service.setPassword(String(account._id), { new_password: 'secret1' });

      expect(await bcrypt.compare('secret1', account.password)).toBe(true);
    });

    it('для смены нужен верный текущий пароль', async () => {
      account.password = await bcrypt.hash('old-pass', 4);

      await expect(
        service.setPassword(String(account._id), {
          new_password: 'secret1',
          current_password: 'wrong',
        }),
      ).rejects.toThrow('WRONG_PASSWORD');

      await service.setPassword(String(account._id), {
        new_password: 'secret1',
        current_password: 'old-pass',
      });
      expect(await bcrypt.compare('secret1', account.password)).toBe(true);
    });

    it('«забыл пароль»: свежий вход через привязанный телефон заменяет текущий пароль', async () => {
      Object.assign(account, { password: await bcrypt.hash('old-pass', 4), phone: phone.subject });

      await service.setPassword(String(account._id), { new_password: 'secret1', reauth: phone });

      expect(await bcrypt.compare('secret1', account.password)).toBe(true);
    });

    it('вход через чужой телефон пароль не меняет', async () => {
      Object.assign(account, { password: await bcrypt.hash('old-pass', 4), phone: phone.subject });

      await expect(
        service.setPassword(String(account._id), {
          new_password: 'secret1',
          reauth: { provider: 'phone', subject: '+359888000000' },
        }),
      ).rejects.toThrow('WRONG_PASSWORD');
    });
  });

  describe('softDelete', () => {
    it('освобождает логин, способы входа и карты, а прежние данные кладёт в снимок', async () => {
      Object.assign(account, {
        login: 'BonusBatko77',
        password: 'hash',
        google_id: 'g-1',
        google_email: 'ivan@gmail.com',
        phone: phone.subject,
        cards: [{ card_id: 'GOTSE-123456', active: true }],
      });

      await service.softDelete(String(account._id));

      const [filter, update] = accountModel.updateOne.mock.calls[0];
      expect(filter).toEqual({ _id: account._id });
      expect(update.$set).toMatchObject({
        login: `deleted_${account._id}`,
        password: null,
        google_id: null,
        phone: null,
        cards: [],
        fcm_token: null,
      });
      expect(update.$set.deleted_at).toBeInstanceOf(Date);
      expect(update.$set.deleted_snapshot).toMatchObject({
        login: 'BonusBatko77',
        google_email: 'ivan@gmail.com',
        phone: phone.subject,
        cards: [{ card_id: 'GOTSE-123456', active: true }],
        password_hash: 'hash',
      });
      // Гасит все выданные токены
      expect(update.$inc).toEqual({ token_version: 1 });
    });
  });
});
