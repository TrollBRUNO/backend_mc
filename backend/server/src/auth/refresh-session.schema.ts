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

  // Когда сессию заменили новой при обновлении токенов. Отличает замену
  // от выхода: заменённый токен ещё ROTATION_GRACE_MS принимается повторно,
  // а отозванный при выходе — нет
  @Prop({ type: Date, default: null })
  rotated_at: Date | null;
}

export const RefreshSessionSchema =
  SchemaFactory.createForClass(RefreshSession);

// Просроченные сессии Mongo удаляет сама. Раньше заменённые и отозванные
// записи копились вечно — по одной на каждый запуск приложения
RefreshSessionSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });
