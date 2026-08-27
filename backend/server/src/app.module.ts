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
import { UploadModule } from './upload/upload.module';
import { NotificationLogModule } from './notification-log/notification-log.module';
import { ActivityLogModule } from './activity-log/activity-log.module';
import { CroupierModule } from './croupier/croupier.module';
import { JackpotSettingsModule } from './jackpot-settings/jackpot-settings.module';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

@Module({
  imports: [
    //MongooseModule.forRoot('mongodb://localhost:27017/mydb'),
    //MongooseModule.forRoot('mongodb://mongo:27017/dbname'),
    MongooseModule.forRoot('mongodb://magicity-mongo:27017/dbname'),
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ActivityLogModule,
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
    TasksModule,
    UploadModule,
    NotificationLogModule,
    CroupierModule,
    JackpotSettingsModule,
    ThrottlerModule.forRoot([
      { name: 'global', ttl: 60000, limit: 400 },
    ]),
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
