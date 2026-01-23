import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type AccountDocument = Account & Document;

@Schema()
export class Account {
  @Prop({ type: Types.Decimal128, default: 0 })
  balance: Types.Decimal128;

  @Prop({ type: Types.Decimal128, default: 0 })
  bonus_balance: Types.Decimal128;

  @Prop({ type: Types.Decimal128, default: 0 })
  fake_balance: Types.Decimal128;

  @Prop({ unique: true, index: true })
  login: string;

  @Prop()
  password: string;

  @Prop()
  realname: string;

  @Prop({ type: String, default: 'user' }) 
  role: string;

  @Prop({ type: String, default: null, sparse: true})
  google_id: string | null;

  @Prop({ type: String, default: null, sparse: true})
  apple_id: string | null;

  @Prop({ type: String, default: null })
  fcm_token: string;

  @Prop({
    type: [
      {
        card_id: String,
        city: String,
        active: Boolean
      }
    ],
    default: []
  })
  cards: {
    card_id: string;
    city: string;
    active: boolean;
  }[];

  @Prop({
    type: {
      wheel_ready: { type: Boolean, default: true },
      bonus_reminder: { type: Boolean, default: true },
      news_post: { type: Boolean, default: true },
      jackpot_win_post: { type: Boolean, default: true },
      jackpot_thresholds: {
        mini: { type: Number, default: 100 },
        middle: { type: Number, default: 500 },
        mega: { type: Number, default: 750 },
      },
    },
    default: {
      wheel_ready: true,
      bonus_reminder: true,
      news_post: true,
      jackpot_win_post: true,
      jackpot_thresholds: {
        mini: 100,
        middle: 500,
        mega: 750,
      },
    },
  })
  notification_settings: {
    wheel_ready: boolean;
    bonus_reminder: boolean;
    news_post: boolean;
    jackpot_win_post: boolean;
    jackpot_thresholds: {
      mini: number;
      middle: number;
      mega: number;
    };
  };

  @Prop({ type: String, default: null })
  bonus_code: string | null;

  @Prop({ type: Date, default: null })
  bonus_code_expire: Date | null;

  @Prop()
  last_spin_date: Date;

  @Prop({ type: Date, default: null })
  last_credit_take_date: Date | null; 

  @Prop({ default: "profile4.png" })
  image_url: string;

  @Prop({ default: false })
  is_blocked: boolean;

  @Prop({ default: '' })
  block_reason: string;

  // Для реализации механизма инвалидирования JWT токенов при смене пароля и т.п.
  @Prop({ default: 0 })
  token_version: number;

  @Prop({ type: Date, default: null }) last_wheel_notify: Date | null; 

  //@Prop({ type: Date, default: null }) last_bonus_notify: Date | null;

  @Prop({ type: Date, default: null }) last_jackpot_notify: Date | null; 

  @Prop({ type: Date, default: null }) last_new_notify: Date | null; 
  
  @Prop({ type: Date, default: null }) last_gallery_notify: Date | null;
}

export const AccountSchema = SchemaFactory.createForClass(Account);