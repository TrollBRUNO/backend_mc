import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { Account, AccountSchema } from "src/account/account.schema";
import { CasinoModule } from "src/casino/casino.module";
import { PushService } from "src/push/push.service";
import { TasksService } from "./tasks.service";

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Account.name, schema: AccountSchema }]),
    CasinoModule,
  ],
  providers: [TasksService, PushService],
})
export class TasksModule {}
