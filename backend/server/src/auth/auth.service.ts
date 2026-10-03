import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';

import { Account, AccountDocument } from '../account/account.schema';
import * as crypto from 'crypto';
import { RefreshSession, RefreshSessionDocument } from './refresh-session.schema';

import { LoginDto } from './dto/login.dto';
import { AccountService } from '../account/account.service';
import { AccountIdentityService } from '../account/account-identity.service';
import {
  IDENTITY_FIELD,
  VerifiedIdentity,
  emailFieldOf,
  isIdentityProvider,
} from '../account/identity.util';
import { FirebaseIdentityService } from './firebase-identity.service';
import { AuthSettingsService } from './auth-settings.service';

const ACCESS_TOKEN_TTL = '15m';

// Сессия живёт год с последнего обновления токенов. Приложение обновляет
// их на каждом запуске, так что выкидывает только того, кто не открывал
// приложение целый год
export const REFRESH_TTL_DAYS = 365;
const REFRESH_TTL_MS = REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000;

// Сколько ещё принимается refresh-токен, который уже заменили новым.
// Ответ с новыми токенами может потеряться в сети, а старые версии
// приложения шлют несколько обновлений разом. Раньше второй запрос
// получал отказ, и приложение разлогинивало человека
export const ROTATION_GRACE_MS = 2 * 60 * 1000;

// Токен регистрации: подтверждённый Google, Apple или номер, который ещё
// не привязан ни к одному аккаунту. С ним приложение либо заводит новый
// аккаунт, либо привязывает способ к существующему. Своя аудитория —
// чтобы его нельзя было подсунуть вместо токена доступа и наоборот
const REGISTRATION_AUDIENCE = 'magicity-registration';
const REGISTRATION_TTL = '30m';

// Откуда пришёл запрос — пишется в сессию для истории входов
interface SessionMeta {
  device_id?: string;
  user_agent?: string;
  ip?: string;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(Account.name)
    private accountModel: Model<AccountDocument>,

    @InjectModel(RefreshSession.name)
    private refreshModel: Model<RefreshSessionDocument>,

    private jwtService: JwtService,
    private accountService: AccountService,
    private accountIdentity: AccountIdentityService,
    private firebaseIdentity: FirebaseIdentityService,
    private authSettings: AuthSettingsService,
  ) {}

  async login(dto: LoginDto, req: any) {
    const account = await this.verifyPassword(dto.login, dto.password);

    if (dto.locale) {
      account.locale = dto.locale as any;
      await account.save();
    }

    return this.issueTokens(account, this.sessionMeta(req));
  }

  // Вход через Google, Apple или телефон. Способ уже привязан к аккаунту —
  // входим. Нет — отдаём токен регистрации, и приложение спрашивает, завести
  // новый аккаунт или привязать способ к существующему
  async signInWithFirebase(idToken: string, req: any) {
    const identity = await this.firebaseIdentity.verify(idToken);
    await this.authSettings.assertProviderEnabled(identity.provider);

    const field = IDENTITY_FIELD[identity.provider];
    const account = await this.accountModel.findOne({ [field]: identity.subject });

    if (account) {
      if (account.is_blocked) {
        throw new ForbiddenException('ACCOUNT_BLOCKED');
      }

      // Почту в Google человек мог сменить — держим в админке актуальную
      const emailField = emailFieldOf(identity.provider);
      if (emailField && identity.email && account.get(emailField) !== identity.email) {
        await this.accountModel.updateOne(
          { _id: account._id },
          { $set: { [emailField]: identity.email } },
        );
      }

      return {
        status: 'signed_in',
        ...(await this.issueTokens(account, this.sessionMeta(req))),
      };
    }

    // Был аккаунт с этим способом, но его удалили — приложение скажет,
    // что аккаунт надо создать заново
    const previouslyDeleted = await this.accountModel.exists({
      [`deleted_snapshot.${field}`]: identity.subject,
    });

    return {
      status: 'not_registered',
      registration_token: this.jwtService.sign(
        {
          provider: identity.provider,
          subject: identity.subject,
          email: identity.email ?? null,
        },
        { audience: REGISTRATION_AUDIENCE, expiresIn: REGISTRATION_TTL },
      ),
      provider: identity.provider,
      email: identity.email ?? null,
      phone: identity.provider === 'phone' ? identity.subject : null,
      previously_deleted: !!previouslyDeleted,
    };
  }

  // «Создать новый аккаунт»: ник генерируется, шаги с городами и картой —
  // те же, что у регистрации по паролю
  async registerWithFirebase(
    dto: {
      registration_token?: string;
      cards?: { card_id: string; casino_id: string; active?: boolean }[];
      notification_preference?: { cities?: string[]; brands?: string[] } | null;
      locale?: string;
    },
    req: any,
  ) {
    const identity = this.verifyRegistrationToken(dto.registration_token);
    await this.authSettings.assertProviderEnabled(identity.provider);

    const account = await this.accountService.registerWithIdentity(identity, {
      cards: dto.cards,
      notification_preference: dto.notification_preference,
      locale: dto.locale,
    });

    return {
      status: 'signed_in',
      login: account.login,
      ...(await this.issueTokens(account, this.sessionMeta(req))),
    };
  }

  // «У меня уже есть аккаунт»: человек входит старыми логином и паролем,
  // и Google, Apple или телефон привязывается к этому аккаунту. Дальше он
  // входит новым способом сразу
  async linkExistingWithPassword(
    dto: { registration_token?: string; login?: string; password?: string },
    req: any,
  ) {
    const identity = this.verifyRegistrationToken(dto.registration_token);
    await this.authSettings.assertProviderEnabled(identity.provider);

    const account = await this.verifyPassword(dto.login ?? '', dto.password ?? '');
    await this.accountIdentity.linkIdentity(String(account._id), identity);

    return {
      status: 'signed_in',
      ...(await this.issueTokens(account, this.sessionMeta(req))),
    };
  }

  // На 401 приложение разлогинивает, поэтому 401 здесь — только когда
  // сессии точно больше нет. Сбой базы и прочие внутренние ошибки уходят
  // как 500: приложение не выходит из аккаунта, а повторяет попытку позже.
  // Раньше любая ошибка внутри превращалась в INVALID_REFRESH_TOKEN
  async refresh(refreshToken: string, req: any) {
    let payload: any;
    try {
      payload = this.jwtService.verify(refreshToken);
    } catch {
      throw new UnauthorizedException('INVALID_REFRESH_TOKEN');
    }

    const session = await this.refreshModel.findOne({
      refresh_token_hash: this.hashToken(refreshToken),
    });

    if (!session) {
      throw new UnauthorizedException('INVALID_REFRESH_TOKEN');
    }

    const now = Date.now();

    if (session.revoked && !this.isInRotationGrace(session, now)) {
      throw new UnauthorizedException('INVALID_REFRESH_TOKEN');
    }

    if (session.expires_at.getTime() < now) {
      throw new UnauthorizedException('REFRESH_EXPIRED');
    }

    // Аккаунт мог быть заблокирован, разжалован, удалён или ему сбросили
    // пароль уже после выдачи refresh-токена — перечитываем состояние из базы
    const account = await this.accountModel.findById(payload.sub);
    if (!account || account.is_blocked) {
      throw new UnauthorizedException('INVALID_REFRESH_TOKEN');
    }
    if (account.deleted_at) {
      throw new UnauthorizedException('ACCOUNT_DELETED');
    }
    if ((account.token_version ?? 0) !== (payload.token_version ?? 0)) {
      throw new UnauthorizedException('TOKEN_REVOKED');
    }

    // 🔁 ROTATION. Заменённую сессию оставляем ещё на ROTATION_GRACE_MS:
    // повтор со старым токеном в это окно получит свою пару токенов.
    // Потом запись уберёт TTL-индекс по expires_at
    if (!session.revoked) {
      session.revoked = true;
      session.rotated_at = new Date(now);
      session.expires_at = new Date(now + ROTATION_GRACE_MS);
      await session.save();
    }

    return this.issueTokens(account, {
      device_id: req?.headers?.['x-device-id'] || session.device_id,
      user_agent: req?.headers?.['user-agent'] ?? session.user_agent,
      ip: req?.ip ?? session.ip,
    });
  }

  async logout(refreshToken: string) {
    const hash = this.hashToken(refreshToken);

    // expires_at = сейчас: запись сразу подберёт TTL-индекс
    const session = await this.refreshModel.findOneAndUpdate(
      { refresh_token_hash: hash },
      { revoked: true, expires_at: new Date() },
    );

    // Вместе с сессией снимаем пуш-токен: иначе после выхода уведомления
    // этого аккаунта продолжали бы приходить на телефон, где уже сидит
    // кто-то другой. Новый владелец пришлёт свой токен при входе
    if (session?.account_id) {
      await this.accountModel.updateOne(
        { _id: session.account_id },
        { $set: { fcm_token: null } },
      );
    }

    return { success: true };
  }

  // Удаление аккаунта: гасим все его сессии сразу, не дожидаясь, пока
  // каждое устройство придёт обновлять токены
  async revokeAllSessions(accountId: string) {
    await this.refreshModel.updateMany(
      { account_id: new Types.ObjectId(accountId), revoked: false },
      { $set: { revoked: true, expires_at: new Date() } },
    );
  }

  // Логин и пароль. Тот же отказ на неизвестный логин и на неверный пароль:
  // по ответу нельзя узнать, существует ли такой логин
  private async verifyPassword(login: string, password: string): Promise<AccountDocument> {
    const account = await this.accountModel.findOne({ login });

    if (!account) {
      if (await this.isDeletedAccountLogin(login, password)) {
        throw new UnauthorizedException('ACCOUNT_DELETED');
      }
      throw new UnauthorizedException('INVALID_CREDENTIALS');
    }

    // Аккаунт, заведённый через Google, Apple или телефон, бывает без пароля
    const passwordOk =
      !!account.password && (await bcrypt.compare(password, account.password));
    if (!passwordOk) {
      throw new UnauthorizedException('INVALID_CREDENTIALS');
    }

    // Заблокированному аккаунту токены не выдаём вовсе
    if (account.is_blocked) {
      throw new ForbiddenException('ACCOUNT_BLOCKED');
    }

    return account;
  }

  // Логин удалённого аккаунта освобождён, но владелец, придя с ним и верным
  // паролем, должен узнать, что аккаунт удалён, а не что ошибся в пароле
  private async isDeletedAccountLogin(login: string, password: string) {
    const deleted = await this.accountModel
      .find({ 'deleted_snapshot.login': login })
      .select('deleted_snapshot.password_hash')
      .lean();

    for (const account of deleted) {
      const hash = account.deleted_snapshot?.password_hash;
      if (hash && (await bcrypt.compare(password, hash))) return true;
    }

    return false;
  }

  private verifyRegistrationToken(token: unknown): VerifiedIdentity {
    try {
      const payload = this.jwtService.verify(String(token ?? ''), {
        audience: REGISTRATION_AUDIENCE,
      });

      if (!isIdentityProvider(payload.provider) || typeof payload.subject !== 'string') {
        throw new Error('malformed registration token');
      }

      return {
        provider: payload.provider,
        subject: payload.subject,
        email: payload.email ?? null,
      };
    } catch {
      // Токен живёт 30 минут: истёк — приложение начинает вход заново
      throw new BadRequestException('INVALID_REGISTRATION_TOKEN');
    }
  }

  private sessionMeta(req: any): SessionMeta {
    return {
      device_id: req?.headers?.['x-device-id'] || 'unknown',
      user_agent: req?.headers?.['user-agent'],
      ip: req?.ip,
    };
  }

  private async issueTokens(account: AccountDocument, meta: SessionMeta) {
    const payload = {
      sub: account._id.toString(),
      role: account.role ?? 'user',
      token_version: account.token_version ?? 0,
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: ACCESS_TOKEN_TTL,
    });

    // jwtid делает каждый refresh-токен уникальным. Без него два обновления
    // в одну секунду подписывали одинаковые токены, и вторая сессия падала
    // на уникальном индексе refresh_token_hash
    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: `${REFRESH_TTL_DAYS}d`,
      jwtid: crypto.randomUUID(),
    });

    await this.refreshModel.create({
      account_id: account._id,
      refresh_token_hash: this.hashToken(refreshToken),
      device_id: meta.device_id,
      user_agent: meta.user_agent,
      ip: meta.ip,
      expires_at: new Date(Date.now() + REFRESH_TTL_MS),
    });

    // «Последний вход» для админки: вход любым способом или запуск приложения
    await this.accountModel.updateOne(
      { _id: account._id },
      { $set: { last_login_at: new Date() } },
    );

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
    };
  }

  private isInRotationGrace(session: RefreshSessionDocument, now: number) {
    return (
      !!session.rotated_at &&
      now - session.rotated_at.getTime() < ROTATION_GRACE_MS
    );
  }

  private hashToken(token: string): string {
    return crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');
  }
}
