import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Statistics, StatisticsSchema } from './statistics.schema';
import { StatisticsService } from './statistics.service';
import { StatisticsController } from './statistics.controller';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Statistics.name, schema: StatisticsSchema }])
  ],
  providers: [StatisticsService],
  controllers: [StatisticsController]
})
export class StatisticsModule {}
