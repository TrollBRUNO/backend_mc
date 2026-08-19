import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ActivityLog, ActivityLogSchema } from './activity-log.schema';
import { ActivityLogService } from './activity-log.service';
import { AuthorshipService } from './authorship.service';
import { Account, AccountSchema } from '../account/account.schema';

// Global — журнал и проверка авторства нужны сразу в news, gallery, casino и croupier
@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ActivityLog.name, schema: ActivityLogSchema },
      { name: Account.name, schema: AccountSchema },
    ]),
  ],
  providers: [ActivityLogService, AuthorshipService],
  exports: [ActivityLogService, AuthorshipService, MongooseModule],
})
export class ActivityLogModule {}
