import {
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

    const payload = {
      sub: account._id.toString(),
      role: account.role ?? 'user',
      token_version: account.token_version ?? 0,
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: '15m',
    });

    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: '90d',
    });

    await this.refreshModel.create({
      account_id: account._id,
      refresh_token_hash: this.hashToken(refreshToken),
      device_id: req.headers['x-device-id'] || 'unknown',
      user_agent: req.headers['user-agent'],
      ip: req.ip,
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
    };
  }

  async refresh(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken);
    
      const hash = this.hashToken(refreshToken);

      const session = await this.refreshModel.findOne({
        refresh_token_hash: hash,
        revoked: false,
      });

      if (!session) {
        throw new UnauthorizedException('INVALID_REFRESH_TOKEN');
      }

      if (session.expires_at < new Date()) {
        throw new UnauthorizedException('REFRESH_EXPIRED');
      }

      // 🔁 ROTATION
      session.revoked = true;
      await session.save();

      const newPayload = {
        sub: payload.sub,
        role: payload.role,
        token_version: payload.token_version,
      };

      const newAccessToken = this.jwtService.sign(newPayload, {
        expiresIn: '15m',
      });

      const newRefreshToken = this.jwtService.sign(newPayload, {
        expiresIn: '90d',
      });

      await this.refreshModel.create({
        account_id: session.account_id,
        refresh_token_hash: this.hashToken(newRefreshToken),
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });

      return {
        access_token: newAccessToken,
        refresh_token: newRefreshToken,
      };
    } catch {
      throw new UnauthorizedException('INVALID_REFRESH_TOKEN');
    }
  }

  async logout(refreshToken: string) {
    const hash = this.hashToken(refreshToken);

    await this.refreshModel.updateOne(
      { refresh_token_hash: hash },
      { revoked: true },
    );

    return { success: true };
  }

  private hashToken(token: string): string {
    return crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');
  }
}
