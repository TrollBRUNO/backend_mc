import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ActivityLogDocument = ActivityLog & Document;

export enum ActivityEntity {
  NEWS = 'news',
  GALLERY = 'gallery',
  EVENT = 'event',
}

export enum ActivityAction {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
}

// Журнал контентных действий крупье и админов.
// Отдельная коллекция, а не выборка по created_by, потому что записи исчезают:
// новость/выигрыш админ может удалить, а прошедшие мероприятия каждую минуту
// вычищает крон TasksService.removeExpiredCasinoEvents. История должна остаться.
@Schema()
export class ActivityLog {
  @Prop({ type: Types.ObjectId, ref: 'Account', required: true, index: true })
  account_id: Types.ObjectId;

  // Снимок логина и роли на момент действия: история читается,
  // даже если аккаунт переименовали, разжаловали или удалили
  @Prop({ type: String, required: true })
  login: string;

  @Prop({ type: String, default: null })
  role: string | null;

  @Prop({ type: String, enum: ActivityAction, required: true })
  action: ActivityAction;

  @Prop({ type: String, enum: ActivityEntity, required: true })
  entity: ActivityEntity;

  @Prop({ type: String, default: null })
  entity_id: string | null;

  // Снимок заголовка (для выигрыша — описание, для мероприятия — название)
  @Prop({ type: Map, of: String, default: {} })
  title: Record<string, string>;

  @Prop({ type: Types.ObjectId, ref: 'Casino', default: null, index: true })
  casino_id: Types.ObjectId | null;

  @Prop({ type: Date, default: Date.now, index: true })
  created_at: Date;
}

export const ActivityLogSchema = SchemaFactory.createForClass(ActivityLog);

ActivityLogSchema.index({ account_id: 1, created_at: -1 });
ActivityLogSchema.index({ entity: 1, created_at: -1 });
