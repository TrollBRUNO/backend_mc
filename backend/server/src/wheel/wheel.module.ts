import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Wheel, WheelSchema } from './wheel.schema';
import { WheelService } from './wheel.service';
import { WheelController } from './wheel.controller';
import { Statistics, StatisticsSchema } from 'src/statistics/statistics.schema';
import { Account, AccountSchema } from 'src/account/account.schema';

@Module({
  imports: [
      MongooseModule.forFeature([
        { name: Wheel.name, schema: WheelSchema },
        { name: Account.name, schema: AccountSchema },
        { name: Statistics.name, schema: StatisticsSchema },
      ])
    ],
  providers: [WheelService],
  controllers: [WheelController]
})
export class WheelModule {}
