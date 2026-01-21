import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

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
}

export const NewsSchema = SchemaFactory.createForClass(News);
