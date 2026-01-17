import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { Account, AccountSchema } from "src/account/account.schema";
import { CasinoModule } from "src/casino/casino.module";
import { TasksService } from "./tasks.service";
import { PushModule } from "src/push/push.module";

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Account.name, schema: AccountSchema }]),
    CasinoModule, 
    PushModule,
  ],
  providers: [TasksService],
  exports: [TasksService],
})
export class TasksModule {}
