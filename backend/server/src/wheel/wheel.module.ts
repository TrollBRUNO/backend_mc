import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Wheel, WheelSchema } from './wheel.schema';
import { WheelService } from './wheel.service';
import { WheelController } from './wheel.controller';

@Module({
  imports: [
      MongooseModule.forFeature([{ name: Wheel.name, schema: WheelSchema }])
    ],
  providers: [WheelService],
  controllers: [WheelController]
})
export class WheelModule {}
