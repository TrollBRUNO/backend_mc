import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CasinoDocument = Casino & Document;

@Schema()
export class Casino {
  @Prop({ type: Map, of: String })
  city: Record<string, string>;

  @Prop({ type: Map, of: String })
  address: Record<string, string>;

  @Prop({ type: Map, of: String })
  name: Record<string, string>;

  @Prop({ default: Date.now })
  create_date: Date;

  @Prop({ default: true})
  mystery_progressive: boolean;

  @Prop({ type: [String], default: [] })
  jackpot_url: string[];

  @Prop()
  image_url: string;

  @Prop({
    type: [
      {
        name: String,
        description: String,
        start: Date,
        end: Date,
        active: { type: Boolean, default: false },
      },
    ],
    default: [],
  })
  events: {
    name: string;
    description: string;
    start: Date;
    end: Date;
    active: boolean;
  }[];

  @Prop({ type: [String], default: [] })
  uu_id_list: string[];

  @Prop({ type: [String], default: [] })
  photos: string[];

  @Prop({ type: Number, default: null })
  latitude: number | null;

  @Prop({ type: Number, default: null })
  longitude: number | null;
}

export const CasinoSchema = SchemaFactory.createForClass(Casino);