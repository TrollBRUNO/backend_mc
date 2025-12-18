import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type RefreshSessionDocument = RefreshSession & Document;

@Schema({ timestamps: true })
export class RefreshSession {
  @Prop({ type: Types.ObjectId, ref: 'Account', index: true })
  account_id: Types.ObjectId;

  @Prop({ required: true, unique: true })
  refresh_token_hash: string;

  @Prop()
  device_id: string;

  @Prop()
  user_agent: string;

  @Prop()
  ip: string;

  @Prop({ required: true })
  expires_at: Date;

  @Prop({ default: false })
  revoked: boolean;
}

export const RefreshSessionSchema =
  SchemaFactory.createForClass(RefreshSession);
