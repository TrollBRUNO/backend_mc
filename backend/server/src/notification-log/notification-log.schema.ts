import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type NotificationLogDocument = NotificationLog & Document;

export enum NotificationLogType {
  JACKPOT_MINI     = 'jackpot_mini',
  JACKPOT_MIDDLE   = 'jackpot_middle',
  JACKPOT_MEGA     = 'jackpot_mega',
  NIGHTLY_REMINDER = 'nightly_reminder',
  WHEEL_READY      = 'wheel_ready',
  BONUS_REMINDER   = 'bonus_reminder',
}

@Schema()
export class NotificationLog {
  @Prop({ type: Types.ObjectId, ref: 'Account', required: true })
  account_id: Types.ObjectId;

  @Prop({ type: String, enum: NotificationLogType, required: true })
  type: NotificationLogType;

  @Prop({ type: Date, default: Date.now, index: true })
  sent_at: Date;

  @Prop({
    type: {
      casino_id: { type: String },
      jackpot_value: { type: Number },
    },
    required: false,
    default: undefined,
  })
  meta?: {
    // TODO гранулярность: в будущем per-casino пороги и фильтрация по casino_id
    casino_id?: string;
    jackpot_value?: number;
  };
}

export const NotificationLogSchema = SchemaFactory.createForClass(NotificationLog);

NotificationLogSchema.index({ account_id: 1, sent_at: -1 });
NotificationLogSchema.index({ sent_at: 1, type: 1 });
