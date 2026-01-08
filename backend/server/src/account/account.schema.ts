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

}

export const AccountSchema = SchemaFactory.createForClass(Account);