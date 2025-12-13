import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type WheelDocument = Wheel & Document;

@Schema()
export class Wheel {
  @Prop()
  value: number;
}

export const WheelSchema = SchemaFactory.createForClass(Wheel);
