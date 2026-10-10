import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Statistics, StatisticsSchema } from './statistics.schema';
import { Account, AccountSchema } from '../account/account.schema';
import { Casino, CasinoSchema } from '../casino/casino.schema';
import { Wheel, WheelSchema } from '../wheel/wheel.schema';
import { StatisticsService } from './statistics.service';
import { StatisticsController } from './statistics.controller';
import { WheelStatsService } from './wheel-stats.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Statistics.name, schema: StatisticsSchema },
      { name: Account.name, schema: AccountSchema },
      // Только модели, без модулей: учёт колеса нужен прокрутке, кассе
      // и cron, и полные импорты замкнули бы зависимости в круг
      { name: Casino.name, schema: CasinoSchema },
      { name: Wheel.name, schema: WheelSchema },
    ])
  ],
  providers: [StatisticsService, WheelStatsService],
  controllers: [StatisticsController],
  exports: [WheelStatsService],
})
export class StatisticsModule {}
