import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type DemoSpinDocument = DemoSpin & Document;

@Schema()
export class DemoSpin {
  @Prop({ required: true, unique: true })
  demo_id: string;

  @Prop({ required: true })
  amount: number;

  @Prop({ default: Date.now, expires: 259200 })
  created_at: Date;
}

export const DemoSpinSchema = SchemaFactory.createForClass(DemoSpin);
