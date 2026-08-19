import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type NewsDocument = News & Document;

@Schema()
export class News {
  @Prop({ type: Map, of: String }) // ключ — язык, значение — заголовок
  title: Record<string, string>;

  @Prop({ type: Map, of: String }) // ключ — язык, значение — описание
  description: Record<string, string>;

  @Prop({ default: Date.now })
  create_date: Date;

  @Prop()
  image_url: string;

  // Автор записи. null — новость создана до появления роли крупье
  @Prop({ type: Types.ObjectId, ref: 'Account', default: null, index: true })
  created_by: Types.ObjectId | null;

  // Ник автора на момент создания — чтобы админка не ходила за аккаунтом
  @Prop({ type: String, default: null })
  created_by_login: string | null;

  // Зал, от имени которого опубликовано. Новость видна всем,
  // поле нужно только для фильтра по казино в админке
  @Prop({ type: Types.ObjectId, ref: 'Casino', default: null, index: true })
  casino_id: Types.ObjectId | null;
}

export const NewsSchema = SchemaFactory.createForClass(News);

NewsSchema.index({ created_by: 1, create_date: -1 });
NewsSchema.index({ casino_id: 1, create_date: -1 });
