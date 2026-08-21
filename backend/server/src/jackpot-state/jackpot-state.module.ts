import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JackpotState, JackpotStateSchema } from './jackpot-state.schema';
import { JackpotStateService } from './jackpot-state.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: JackpotState.name, schema: JackpotStateSchema },
    ]),
  ],
  providers: [JackpotStateService],
  exports: [JackpotStateService],
})
export class JackpotStateModule {}
