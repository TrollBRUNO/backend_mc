import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CasinoDocument = Casino & Document;

@Schema()
export class Casino {
  @Prop()
  city: string;

  @Prop()
  address: string;

  @Prop({ default: Date.now })
  create_date: Date;

  @Prop({ default: true})
  mystery_progressive: boolean;

  @Prop()
  jackpot_url: string;

  @Prop()
  image_url: string;

  @Prop({ type: [String], default: [] })
  uu_id_list: string[];
}

export const CasinoSchema = SchemaFactory.createForClass(Casino);