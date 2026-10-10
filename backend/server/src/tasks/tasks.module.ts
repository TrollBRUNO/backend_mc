import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { Account, AccountSchema } from "../account/account.schema";
import { CasinoModule } from "../casino/casino.module";
import { TasksService } from "./tasks.service";
import { PushModule } from "../push/push.module";
import { NotificationLogModule } from "../notification-log/notification-log.module";
import { JackpotStateModule } from "../jackpot-state/jackpot-state.module";
import { StatisticsModule } from "../statistics/statistics.module";

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Account.name, schema: AccountSchema }]),
    CasinoModule,
    PushModule,
    NotificationLogModule,
    JackpotStateModule,
    // Сгоревшие за сутки выигрыши колеса отмечаются в учёте
    StatisticsModule,
  ],
  providers: [TasksService],
  exports: [TasksService],
})
export class TasksModule {}
