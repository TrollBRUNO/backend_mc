import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Wheel, WheelSchema } from './wheel.schema';
import { WheelService } from './wheel.service';
import { WheelController } from './wheel.controller';
import { Account, AccountSchema } from '../account/account.schema';
import { DemoSpin, DemoSpinSchema } from './demo-spin.schema';
import { StatisticsModule } from '../statistics/statistics.module';

@Module({
  imports: [
      MongooseModule.forFeature([
        { name: Wheel.name, schema: WheelSchema },
        { name: Account.name, schema: AccountSchema },
        { name: DemoSpin.name, schema: DemoSpinSchema },
      ]),
      // Каждая прокрутка записывается в учёт выигрышей колеса
      StatisticsModule,
    ],
  providers: [WheelService],
  controllers: [WheelController]
})
export class WheelModule {}
