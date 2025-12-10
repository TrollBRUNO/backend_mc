import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Support, SupportSchema } from './support.schema';
import { SupportService } from './support.service';
import { SupportController } from './support.controller';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Support.name, schema: SupportSchema }])
  ],
  providers: [SupportService],
  controllers: [SupportController]
})
export class SupportModule {}
