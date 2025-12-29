import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from 'mongoose';

export type BonusCodeDocument = BonusCode & Document;

@Schema({ timestamps: true })
export class BonusCode {
  @Prop({ required: true, index: true })
  code: string;

  @Prop({ type: Types.ObjectId, ref: 'Account', required: true })
  account_id: Types.ObjectId;

  @Prop({ required: true })
  expires_at: Date;

  @Prop({ default: false })
  used: boolean;
}

export const BonusCodeSchema = SchemaFactory.createForClass(BonusCode);

// 🔥 TTL — Mongo сам удалит документ
BonusCodeSchema.index(
  { expires_at: 1 },
  { expireAfterSeconds: 0 }
);
