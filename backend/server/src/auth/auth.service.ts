import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';

import { Account, AccountDocument } from '../account/account.schema';
import * as crypto from 'crypto';
import { RefreshSession, RefreshSessionDocument } from './refresh-session.schema';

import { LoginDto } from './dto/login.dto';

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
  ) {}

  async login(dto: LoginDto, req: any) {
    const account = await this.accountModel.findOne({ login: dto.login });

    if (!account) {
      throw new UnauthorizedException('INVALID_CREDENTIALS');
    }

    const passwordOk = await bcrypt.compare(dto.password, account.password);
    if (!passwordOk) {
      throw new UnauthorizedException('INVALID_CREDENTIALS');
    }

    // Заблокированному аккаунту токены не выдаём вовсе
    if (account.is_blocked) {
      throw new ForbiddenException('ACCOUNT_BLOCKED');
    }

    if (dto.locale) {
      account.locale = dto.locale as any;
      await account.save();
    }

    return this.issueTokens(account, {
      device_id: req.headers['x-device-id'] || 'unknown',
      user_agent: req.headers['user-agent'],
      ip: req.ip,
    });
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

    // Аккаунт мог быть заблокирован, разжалован или ему сбросили пароль
    // уже после выдачи refresh-токена — перечитываем состояние из базы
    const account = await this.accountModel.findById(payload.sub);
    if (!account || account.is_blocked) {
      throw new UnauthorizedException('INVALID_REFRESH_TOKEN');
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
