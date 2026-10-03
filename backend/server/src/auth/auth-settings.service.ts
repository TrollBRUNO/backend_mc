import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { AuthSettings, AuthSettingsDocument } from './auth-settings.schema';
import { IdentityProvider } from '../account/identity.util';

export interface AuthSettingsView {
  phone_login_enabled: boolean;
}

@Injectable()
export class AuthSettingsService {
  constructor(
    @InjectModel(AuthSettings.name)
    private readonly settingsModel: Model<AuthSettingsDocument>,
  ) {}

  // Документа может не быть вовсе — тогда всё включено. Создаётся он
  // первой правкой из админки, чтение в базу не пишет
  async get(): Promise<AuthSettingsView> {
    const doc = await this.settingsModel.findOne().lean();
    return { phone_login_enabled: doc?.phone_login_enabled ?? true };
  }

  async update(dto: { phone_login_enabled?: unknown }): Promise<AuthSettingsView> {
    if (typeof dto?.phone_login_enabled !== 'boolean') {
      throw new BadRequestException('INVALID_SETTINGS');
    }

    await this.settingsModel.updateOne(
      {},
      { $set: { phone_login_enabled: dto.phone_login_enabled, updated_at: new Date() } },
      { upsert: true },
    );

    return this.get();
  }

  async assertProviderEnabled(provider: IdentityProvider): Promise<void> {
    if (provider === 'phone' && !(await this.get()).phone_login_enabled) {
      throw new ForbiddenException('PHONE_LOGIN_DISABLED');
    }
  }
}
