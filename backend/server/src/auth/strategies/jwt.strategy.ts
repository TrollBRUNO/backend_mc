import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Account, AccountDocument } from '../../account/account.schema';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    @InjectModel(Account.name)
    private readonly accountModel: Model<AccountDocument>,
  ) {
    const secret = config.get<string>('JWT_SECRET');

    // Без запасного значения: раньше здесь стояло 'DEV_SECRET' из исходников,
    // и любой, кто видел код, мог подписать себе токен с role: 'admin'
    if (!secret) {
      throw new Error('JWT_SECRET is not set — добавьте его в .env');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: secret,
    });
  }

  // Роль и состояние аккаунта берём из базы, а не из токена: блокировка,
  // смена роли и сброс пароля должны действовать сразу, не дожидаясь
  // истечения выданного токена
  async validate(payload: any) {
    const account = await this.accountModel
      .findById(payload.sub)
      .select('role is_blocked token_version')
      .lean();

    if (!account) throw new UnauthorizedException('ACCOUNT_NOT_FOUND');
    if (account.is_blocked) throw new UnauthorizedException('ACCOUNT_BLOCKED');

    // Сброс пароля админом поднимает token_version — старые токены умирают
    if ((account.token_version ?? 0) !== (payload.token_version ?? 0)) {
      throw new UnauthorizedException('TOKEN_REVOKED');
    }

    return {
      sub: payload.sub,
      role: account.role,
    };
  }
}
