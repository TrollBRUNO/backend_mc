import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type NewsDocument = News & Document;

@Schema()
export class News {
  @Prop()
  title: string;

  @Prop()
  description: string;

  @Prop({ default: Date.now })
  create_date: Date;

  @Prop()
  image_url: string;
}

export const NewsSchema = SchemaFactory.createForClass(News);
