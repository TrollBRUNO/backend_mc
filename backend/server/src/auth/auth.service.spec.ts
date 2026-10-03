import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { Types } from 'mongoose';
import * as bcrypt from 'bcrypt';

import {
  AuthService,
  REFRESH_TTL_DAYS,
  ROTATION_GRACE_MS,
} from './auth.service';
import { Account } from '../account/account.schema';
import { RefreshSession } from './refresh-session.schema';
import { AccountService } from '../account/account.service';
import { AccountIdentityService } from '../account/account-identity.service';
import { FirebaseIdentityService } from './firebase-identity.service';
import { AuthSettingsService } from './auth-settings.service';

const DAY_MS = 24 * 60 * 60 * 1000;

// Коллекция сессий в памяти: ищет по хешу и, как настоящий уникальный
// индекс, не даёт завести две записи с одинаковым хешем
function createSessionModel() {
  const sessions: any[] = [];

  return {
    sessions,
    create: jest.fn(async (doc: any) => {
      if (sessions.some(s => s.refresh_token_hash === doc.refresh_token_hash)) {
        throw new Error('E11000 duplicate key error');
      }
      const session: any = { revoked: false, rotated_at: null, ...doc };
      session.save = jest.fn(async () => session);
      sessions.push(session);
      return session;
    }),
    findOne: jest.fn(
      async (query: any) =>
        sessions.find(s => s.refresh_token_hash === query.refresh_token_hash) ??
        null,
    ),
    findOneAndUpdate: jest.fn(async (query: any, update: any) => {
      const session = sessions.find(
        s => s.refresh_token_hash === query.refresh_token_hash,
      );
      if (!session) return null;
      Object.assign(session, update);
      return session;
    }),
  };
}

describe('AuthService', () => {
  let service: AuthService;
  let sessionModel: ReturnType<typeof createSessionModel>;
  let accountModel: any;
  let account: any;
  let deletedAccounts: any[];
  let now: number;
  let firebaseIdentity: { verify: jest.Mock };
  let authSettings: { assertProviderEnabled: jest.Mock };
  let accountService: { registerWithIdentity: jest.Mock };
  let accountIdentity: { linkIdentity: jest.Mock };

  const req = { headers: { 'user-agent': 'jest' }, ip: '203.0.113.7' };

  beforeEach(async () => {
    now = Date.UTC(2026, 9, 1, 12, 0, 0);
    jest.spyOn(Date, 'now').mockImplementation(() => now);

    account = {
      _id: new Types.ObjectId(),
      login: 'player1',
      password: await bcrypt.hash('secret123', 4),
      google_id: null,
      phone: null,
      role: 'user',
      token_version: 0,
      is_blocked: false,
      deleted_at: null,
      save: jest.fn(),
      get: (key: string) => account[key],
    };
    deletedAccounts = [];

    accountModel = {
      // Совпадение по всем полям запроса: логину, google_id, phone…
      findOne: jest.fn(async (q: any) =>
        Object.entries(q).every(([key, value]) => account[key] === value) ? account : null,
      ),
      findById: jest.fn(async () => account),
      updateOne: jest.fn(async () => ({})),
      exists: jest.fn(async () => null),
      find: jest.fn(() => ({ select: () => ({ lean: async () => deletedAccounts }) })),
    };

    sessionModel = createSessionModel();
    firebaseIdentity = { verify: jest.fn() };
    authSettings = { assertProviderEnabled: jest.fn(async () => undefined) };
    accountService = { registerWithIdentity: jest.fn() };
    accountIdentity = { linkIdentity: jest.fn(async () => ({})) };

    const module: TestingModule = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: 'test-secret' })],
      providers: [
        AuthService,
        { provide: getModelToken(Account.name), useValue: accountModel },
        { provide: getModelToken(RefreshSession.name), useValue: sessionModel },
        { provide: AccountService, useValue: accountService },
        { provide: AccountIdentityService, useValue: accountIdentity },
        { provide: FirebaseIdentityService, useValue: firebaseIdentity },
        { provide: AuthSettingsService, useValue: authSettings },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => jest.restoreAllMocks());

  const login = () =>
    service.login({ login: 'player1', password: 'secret123' }, req);

  describe('login', () => {
    it('выдаёт токены и заводит сессию на год', async () => {
      const tokens = await login();

      expect(tokens.access_token).toBeDefined();
      expect(tokens.refresh_token).toBeDefined();
      expect(sessionModel.sessions).toHaveLength(1);
      expect(sessionModel.sessions[0].expires_at.getTime()).toBe(
        now + REFRESH_TTL_DAYS * DAY_MS,
      );
      expect(sessionModel.sessions[0].ip).toBe('203.0.113.7');
    });

    it('два входа в одну секунду дают разные refresh-токены', async () => {
      const first = await login();
      const second = await login();

      expect(first.refresh_token).not.toBe(second.refresh_token);
      expect(sessionModel.sessions).toHaveLength(2);
    });

    it('неверный пароль — 401', async () => {
      await expect(
        service.login({ login: 'player1', password: 'wrong' }, req),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refresh', () => {
    it('заменяет сессию и продлевает срок на год от момента обновления', async () => {
      const { refresh_token } = await login();
      now += 100 * DAY_MS;

      const tokens = await service.refresh(refresh_token, req);

      const [old, fresh] = sessionModel.sessions;
      expect(old.revoked).toBe(true);
      expect(old.rotated_at.getTime()).toBe(now);
      expect(fresh.expires_at.getTime()).toBe(now + REFRESH_TTL_DAYS * DAY_MS);
      expect(tokens.refresh_token).not.toBe(refresh_token);
    });

    it('повтор со старым токеном в окне замены тоже получает рабочие токены', async () => {
      const { refresh_token } = await login();

      const first = await service.refresh(refresh_token, req);
      now += ROTATION_GRACE_MS - 1000;
      const second = await service.refresh(refresh_token, req);

      expect(second.refresh_token).not.toBe(first.refresh_token);
      await expect(service.refresh(first.refresh_token, req)).resolves.toBeDefined();
      await expect(service.refresh(second.refresh_token, req)).resolves.toBeDefined();
    });

    it('после окна замены старый токен не принимается', async () => {
      const { refresh_token } = await login();
      await service.refresh(refresh_token, req);
      now += ROTATION_GRACE_MS + 1000;

      await expect(service.refresh(refresh_token, req)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('после выхода токен не принимается даже сразу', async () => {
      const { refresh_token } = await login();
      await service.logout(refresh_token);

      await expect(service.refresh(refresh_token, req)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(accountModel.updateOne).toHaveBeenCalledWith(
        { _id: account._id },
        { $set: { fcm_token: null } },
      );
    });

    it('просроченная сессия — 401 REFRESH_EXPIRED', async () => {
      const { refresh_token } = await login();
      sessionModel.sessions[0].expires_at = new Date(now - 1);

      await expect(service.refresh(refresh_token, req)).rejects.toThrow(
        'REFRESH_EXPIRED',
      );
    });

    it('заблокированному аккаунту — 401', async () => {
      const { refresh_token } = await login();
      account.is_blocked = true;

      await expect(service.refresh(refresh_token, req)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('после сброса пароля админом — 401 TOKEN_REVOKED', async () => {
      const { refresh_token } = await login();
      account.token_version = 1;

      await expect(service.refresh(refresh_token, req)).rejects.toThrow(
        'TOKEN_REVOKED',
      );
    });

    it('мусор вместо токена — 401', async () => {
      await expect(service.refresh('not-a-jwt', req)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('сбой базы — не 401, чтобы приложение не разлогинивало', async () => {
      const { refresh_token } = await login();
      sessionModel.findOne.mockRejectedValueOnce(new Error('connection lost'));

      const error = await service.refresh(refresh_token, req).catch(e => e);

      expect(error).not.toBeInstanceOf(UnauthorizedException);
      expect(error.message).toBe('connection lost');
    });

    it('удалённый аккаунт — 401 ACCOUNT_DELETED', async () => {
      const { refresh_token } = await login();
      account.deleted_at = new Date();

      await expect(service.refresh(refresh_token, req)).rejects.toThrow('ACCOUNT_DELETED');
    });
  });

  describe('вход и пароль', () => {
    it('запоминает время последнего входа', async () => {
      await login();

      expect(accountModel.updateOne).toHaveBeenCalledWith(
        { _id: account._id },
        { $set: { last_login_at: expect.any(Date) } },
      );
    });

    it('аккаунт без пароля (пришёл через Google) по паролю не входит', async () => {
      account.password = null;

      await expect(login()).rejects.toThrow('INVALID_CREDENTIALS');
    });

    it('старый логин удалённого аккаунта с верным паролем — ACCOUNT_DELETED', async () => {
      deletedAccounts = [
        { deleted_snapshot: { password_hash: await bcrypt.hash('old-pass', 4) } },
      ];

      await expect(
        service.login({ login: 'gone-player', password: 'old-pass' }, req),
      ).rejects.toThrow('ACCOUNT_DELETED');
      await expect(
        service.login({ login: 'gone-player', password: 'wrong' }, req),
      ).rejects.toThrow('INVALID_CREDENTIALS');
    });
  });

  describe('вход через Google, Apple и телефон', () => {
    const google = { provider: 'google' as const, subject: 'g-1', email: 'ivan@gmail.com' };

    const notRegistered = async () => {
      firebaseIdentity.verify.mockResolvedValueOnce(google);
      return (await service.signInWithFirebase('firebase-id-token', req)) as any;
    };

    it('привязанный Google — сразу вход', async () => {
      account.google_id = 'g-1';
      firebaseIdentity.verify.mockResolvedValueOnce(google);

      const result: any = await service.signInWithFirebase('firebase-id-token', req);

      expect(result.status).toBe('signed_in');
      expect(result.access_token).toBeDefined();
      expect(sessionModel.sessions).toHaveLength(1);
    });

    it('новый Google — токен регистрации, аккаунт не создаётся', async () => {
      const result = await notRegistered();

      expect(result).toMatchObject({
        status: 'not_registered',
        provider: 'google',
        email: 'ivan@gmail.com',
        previously_deleted: false,
      });
      expect(result.registration_token).toBeDefined();
      expect(accountService.registerWithIdentity).not.toHaveBeenCalled();
      expect(sessionModel.sessions).toHaveLength(0);
    });

    it('Google удалённого аккаунта — помечает previously_deleted', async () => {
      accountModel.exists.mockResolvedValueOnce({ _id: new Types.ObjectId() });

      expect((await notRegistered()).previously_deleted).toBe(true);
    });

    it('заблокированному — 403', async () => {
      Object.assign(account, { google_id: 'g-1', is_blocked: true });
      firebaseIdentity.verify.mockResolvedValueOnce(google);

      await expect(service.signInWithFirebase('firebase-id-token', req)).rejects.toThrow(
        'ACCOUNT_BLOCKED',
      );
    });

    it('выключенный вход по телефону — отказ', async () => {
      firebaseIdentity.verify.mockResolvedValueOnce({ provider: 'phone', subject: '+359888123456' });
      authSettings.assertProviderEnabled.mockRejectedValueOnce(new Error('PHONE_LOGIN_DISABLED'));

      await expect(service.signInWithFirebase('firebase-id-token', req)).rejects.toThrow(
        'PHONE_LOGIN_DISABLED',
      );
    });

    it('«Создать новый аккаунт» по токену регистрации', async () => {
      const { registration_token } = await notRegistered();
      accountService.registerWithIdentity.mockResolvedValueOnce({
        ...account,
        login: 'BonusBatko77',
      });

      const result: any = await service.registerWithFirebase(
        { registration_token, locale: 'bg' },
        req,
      );

      expect(accountService.registerWithIdentity).toHaveBeenCalledWith(google, {
        cards: undefined,
        notification_preference: undefined,
        locale: 'bg',
      });
      expect(result).toMatchObject({ status: 'signed_in', login: 'BonusBatko77' });
      expect(result.refresh_token).toBeDefined();
    });

    it('токен доступа вместо токена регистрации не принимается', async () => {
      const { access_token } = await login();

      await expect(
        service.registerWithFirebase({ registration_token: access_token }, req),
      ).rejects.toThrow('INVALID_REGISTRATION_TOKEN');
    });

    it('«У меня уже есть аккаунт»: верный пароль — Google привязывается', async () => {
      const { registration_token } = await notRegistered();

      const result: any = await service.linkExistingWithPassword(
        { registration_token, login: 'player1', password: 'secret123' },
        req,
      );

      expect(accountIdentity.linkIdentity).toHaveBeenCalledWith(String(account._id), google);
      expect(result.status).toBe('signed_in');
    });

    it('«У меня уже есть аккаунт»: неверный пароль — ничего не привязывается', async () => {
      const { registration_token } = await notRegistered();

      await expect(
        service.linkExistingWithPassword(
          { registration_token, login: 'player1', password: 'wrong' },
          req,
        ),
      ).rejects.toThrow('INVALID_CREDENTIALS');
      expect(accountIdentity.linkIdentity).not.toHaveBeenCalled();
    });
  });
});
