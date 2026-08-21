import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Account, AccountSchema } from './account.schema';
import { AccountService } from './account.service';
import { AccountController } from './account.controller';
import { Casino, CasinoSchema } from '../casino/casino.schema';
import { PushModule } from '../push/push.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Account.name, schema: AccountSchema },
      // Только модель, не CasinoModule: привязка карты сверяется с залом,
      // а полноценный импорт модуля дал бы циклическую зависимость
      { name: Casino.name, schema: CasinoSchema },
    ]),
    PushModule,
  ],
  providers: [AccountService],
  controllers: [AccountController],
  exports: [AccountService, MongooseModule],
})
export class AccountModule {}
