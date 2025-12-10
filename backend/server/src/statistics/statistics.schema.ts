import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type StatisticsDocument = Statistics & Document;

@Schema()
export class Statistics {
  @Prop()
  spin_date: Date;

  @Prop()
  prize_count: number;

  @Prop()
  user_id: string;
}

export const StatisticsSchema = SchemaFactory.createForClass(Statistics);
