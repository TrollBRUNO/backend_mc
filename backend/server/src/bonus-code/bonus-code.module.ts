import { Module } from '@nestjs/common';
import { BonusCodeService } from './bonus-code.service';
import { BonusCodeController } from './bonus-code.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { BonusCode, BonusCodeSchema } from './bonus-code.schema';
import { Account, AccountSchema } from 'src/account/account.schema';

@Module({
  imports: [
        MongooseModule.forFeature([
          { name: BonusCode.name, schema: BonusCodeSchema },
          { name: Account.name, schema: AccountSchema },
        ])
      ],
  providers: [BonusCodeService],
  controllers: [BonusCodeController]
})
export class BonusCodeModule {}
