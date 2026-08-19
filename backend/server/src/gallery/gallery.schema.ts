import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type GalleryDocument = Gallery & Document;

// Выигрыши (галерея джекпотов)
@Schema()
export class Gallery {
  @Prop({ type: Map, of: String })
  description: Record<string, string>;

  @Prop({ default: Date.now })
  create_date: Date;

  @Prop()
  image_url: string;

  // Автор записи. null — выигрыш создан до появления роли крупье
  @Prop({ type: Types.ObjectId, ref: 'Account', default: null, index: true })
  created_by: Types.ObjectId | null;

  // Ник автора на момент создания — чтобы админка не ходила за аккаунтом
  @Prop({ type: String, default: null })
  created_by_login: string | null;

  // Зал, от имени которого опубликован. Выигрыш виден всем,
  // поле нужно только для фильтра по казино в админке
  @Prop({ type: Types.ObjectId, ref: 'Casino', default: null, index: true })
  casino_id: Types.ObjectId | null;
}

export const GallerySchema = SchemaFactory.createForClass(Gallery);

GallerySchema.index({ created_by: 1, create_date: -1 });
GallerySchema.index({ casino_id: 1, create_date: -1 });
