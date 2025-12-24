import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Statistics, StatisticsSchema } from './statistics.schema';
import { Account, AccountSchema } from 'src/account/account.schema';
import { StatisticsService } from './statistics.service';
import { StatisticsController } from './statistics.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Statistics.name, schema: StatisticsSchema },
      { name: Account.name, schema: AccountSchema },
    ])
  ],
  providers: [StatisticsService],
  controllers: [StatisticsController]
})
export class StatisticsModule {}
