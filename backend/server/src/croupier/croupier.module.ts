import { Module } from '@nestjs/common';
import { CroupierService } from './croupier.service';
import { CroupierController } from './croupier.controller';
import { AccountModule } from '../account/account.module';
import { CasinoModule } from '../casino/casino.module';

// Модели Account и Casino приходят из экспортов AccountModule/CasinoModule,
// ActivityLogService — из глобального ActivityLogModule
@Module({
  imports: [AccountModule, CasinoModule],
  providers: [CroupierService],
  controllers: [CroupierController],
  exports: [CroupierService],
})
export class CroupierModule {}
