import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SupportDocument = Support & Document;

@Schema()
export class Support {
  @Prop()
  description_problem: string;

  @Prop({ default: Date.now })
  create_date: Date;

  @Prop()
  user_id: string;

  @Prop({ default: 'open' })
  status: string;
}

export const SupportSchema = SchemaFactory.createForClass(Support);
