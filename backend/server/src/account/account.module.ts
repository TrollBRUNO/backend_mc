import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Account, AccountSchema } from './account.schema';
import { AccountService } from './account.service';
import { AccountController } from './account.controller';
import { Casino, CasinoSchema } from '../casino/casino.schema';
import { PushModule } from '../push/push.module';
import { JackpotSettingsModule } from '../jackpot-settings/jackpot-settings.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Account.name, schema: AccountSchema },
      // Только модель, не CasinoModule: привязка карты сверяется с залом,
      // а полноценный импорт модуля дал бы циклическую зависимость
      { name: Casino.name, schema: CasinoSchema },
    ]),
    PushModule,
    // Рамки, в которые упираются пороги джекпота при записи настроек
    JackpotSettingsModule,
  ],
  providers: [AccountService],
  controllers: [AccountController],
  exports: [AccountService, MongooseModule],
})
export class AccountModule {}
