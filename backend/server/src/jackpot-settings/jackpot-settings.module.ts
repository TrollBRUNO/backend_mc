import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JackpotSettingsService } from './jackpot-settings.service';
import { JackpotSettingsController } from './jackpot-settings.controller';
import {
  JackpotSettings,
  JackpotSettingsSchema,
} from './jackpot-settings.schema';
import { Account, AccountSchema } from '../account/account.schema';

// Модель Account берём напрямую через forFeature, а не импортом AccountModule:
// AccountModule сам зависит от этого модуля (пороги при записи настроек
// подрезаются по этим же рамкам), и импорт в обе стороны замкнул бы круг
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: JackpotSettings.name, schema: JackpotSettingsSchema },
      { name: Account.name, schema: AccountSchema },
    ]),
  ],
  providers: [JackpotSettingsService],
  controllers: [JackpotSettingsController],
  exports: [JackpotSettingsService],
})
export class JackpotSettingsModule {}
