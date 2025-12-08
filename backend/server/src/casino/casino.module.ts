import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Casino, CasinoSchema } from './casino.schema';
import { CasinoService } from './casino.service';
import { CasinoController } from './casino.controller';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Casino.name, schema: CasinoSchema }])
  ],
  providers: [CasinoService],
  controllers: [CasinoController]
})
export class CasinoModule {}
