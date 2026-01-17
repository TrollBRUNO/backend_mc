import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MongooseModule } from '@nestjs/mongoose';
import { NewsModule } from './news/news.module';
import { GalleryModule } from './gallery/gallery.module';
import { CasinoModule } from './casino/casino.module';
import { AccountModule } from './account/account.module';
import { SupportModule } from './support/support.module';
import { StatisticsModule } from './statistics/statistics.module';
import { WheelModule } from './wheel/wheel.module';
import { AuthModule } from './auth/auth.module';
import { BonusCodeModule } from './bonus-code/bonus-code.module';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PushModule } from './push/push.module';
import { TasksModule } from './tasks/tasks.module';

@Module({
  imports: [
    //MongooseModule.forRoot('mongodb://localhost:27017/mydb'),
    //MongooseModule.forRoot('mongodb://mongo:27017/dbname'),
    MongooseModule.forRoot('mongodb://magicity-mongo:27017/dbname'),
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    NewsModule,
    GalleryModule,
    CasinoModule,
    AccountModule,
    SupportModule,
    StatisticsModule,
    WheelModule,
    AuthModule,
    BonusCodeModule,
    ScheduleModule.forRoot(),
    PushModule,
    TasksModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
