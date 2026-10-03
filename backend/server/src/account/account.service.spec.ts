import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';

import { AccountService } from './account.service';
import { Account } from './account.schema';
import { Casino } from '../casino/casino.schema';
import { JackpotSettingsService } from '../jackpot-settings/jackpot-settings.service';
import { NICKNAME_BASES } from './nickname.util';

describe('AccountService', () => {
  let service: AccountService;
  let accountModel: any;
  let found: any[];

  beforeEach(async () => {
    found = [];

    accountModel = {
      exists: jest.fn(async () => null),
      create: jest.fn(async (doc: any) => ({ _id: new Types.ObjectId(), ...doc })),
      findOne: jest.fn(async () => null),
      find: jest.fn(() => ({ lean: async () => found })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountService,
        { provide: getModelToken(Account.name), useValue: accountModel },
        { provide: getModelToken(Casino.name), useValue: {} },
        { provide: JackpotSettingsService, useValue: {} },
      ],
    }).compile();

    service = module.get<AccountService>(AccountService);
  });

  describe('registerWithIdentity', () => {
    const google = { provider: 'google' as const, subject: 'g-1', email: 'ivan@gmail.com' };

    it('заводит аккаунт с ником из списка, без имени и пароля', async () => {
      const account = await service.registerWithIdentity(google, { locale: 'el' });

      const doc = accountModel.create.mock.calls[0][0];
      expect(NICKNAME_BASES.some(base => doc.login.startsWith(base))).toBe(true);
      expect(doc).toMatchObject({
        realname: '',
        google_id: 'g-1',
        google_email: 'ivan@gmail.com',
        registration_method: 'google',
        role: 'user',
        locale: 'el',
      });
      expect(doc.password).toBeUndefined();
      expect(doc.created_at).toBeInstanceOf(Date);
      expect(account.login).toBe(doc.login);
    });

    it('телефон кладётся в phone, почты у него нет', async () => {
      await service.registerWithIdentity({ provider: 'phone', subject: '+359888123456' }, {});

      const doc = accountModel.create.mock.calls[0][0];
      expect(doc.phone).toBe('+359888123456');
      expect(doc.registration_method).toBe('phone');
      expect(doc).not.toHaveProperty('google_email');
    });

    it('незнакомая локаль заменяется болгарской', async () => {
      await service.registerWithIdentity(google, { locale: 'xx' });
      expect(accountModel.create.mock.calls[0][0].locale).toBe('bg');
    });

    it('уже привязанный способ — IDENTITY_TAKEN', async () => {
      accountModel.exists.mockResolvedValueOnce({ _id: new Types.ObjectId() });

      await expect(service.registerWithIdentity(google, {})).rejects.toThrow('IDENTITY_TAKEN');
      expect(accountModel.create).not.toHaveBeenCalled();
    });

    it('ник заняли параллельно — берёт другой', async () => {
      accountModel.create.mockRejectedValueOnce({ code: 11000, keyPattern: { login: 1 } });

      await service.registerWithIdentity(google, {});

      expect(accountModel.create).toHaveBeenCalledTimes(2);
    });

    it('тот же Google зарегистрировали параллельно — IDENTITY_TAKEN', async () => {
      accountModel.create.mockRejectedValueOnce({ code: 11000, keyPattern: { google_id: 1 } });

      await expect(service.registerWithIdentity(google, {})).rejects.toThrow('IDENTITY_TAKEN');
    });
  });

  describe('search (админка)', () => {
    it('не отдаёт хеш пароля, зато отдаёт способы входа и дату регистрации', async () => {
      found = [
        {
          _id: new Types.ObjectId(),
          login: 'player1',
          password: 'hash',
          phone: '+359888123456',
          deleted_snapshot: null,
        },
      ];

      const [view] = await service.search('0888');

      expect(view).not.toHaveProperty('password');
      expect(view).toMatchObject({
        login: 'player1',
        realname: '',
        has_password: true,
        is_deleted: false,
        login_methods: { password: true, phone: '+359888123456' },
      });
      expect(view.created_at).toBeInstanceOf(Date);
    });

    it('ищет телефон в формате 08… и не падает на «+»', async () => {
      await service.search('+359 888');
      await service.search('0888');

      const queries = accountModel.find.mock.calls.map(([q]: any[]) => q.$or);
      expect(queries[0]).toContainEqual({ phone: /359888/ });
      expect(queries[1]).toContainEqual({ phone: /359888/ });
    });

    it('у удалённого отдаёт снимок, но без хеша пароля', async () => {
      found = [
        {
          _id: new Types.ObjectId(),
          login: 'deleted_x',
          deleted_at: new Date(),
          deleted_snapshot: { login: 'BonusBatko77', password_hash: 'hash' },
        },
      ];

      const [view] = await service.search('BonusBatko');

      expect(view.is_deleted).toBe(true);
      expect(view.deleted_snapshot).toEqual({ login: 'BonusBatko77' });
    });
  });
});
