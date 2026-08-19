import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type CasinoDocument = Casino & Document;

// Мероприятие зала. Хранится вложенным массивом в документе казино,
// _id подставляет mongoose — по нему работают точечные ручки
// POST/PUT/DELETE /casino/:id/events
export interface CasinoEvent {
  _id?: Types.ObjectId;
  name: Record<string, string>;
  description: Record<string, string>;
  start: Date;
  end: Date;
  active: boolean;
  created_by?: Types.ObjectId | null;
  created_by_login?: string | null;
}

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
        name: { type: Map, of: String },
        description: { type: Map, of: String },
        start: Date,
        end: Date,
        active: { type: Boolean, default: false },
        // Автор мероприятия. null — создано до появления роли крупье
        created_by: { type: Types.ObjectId, ref: 'Account', default: null },
        created_by_login: { type: String, default: null },
      },
    ],
    default: [],
  })
  events: CasinoEvent[];

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
