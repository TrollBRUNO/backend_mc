import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type GalleryDocument = Gallery & Document;

@Schema()
export class Gallery {
  @Prop({ type: Map, of: String })
  description: Record<string, string>;

  @Prop({ default: Date.now })
  create_date: Date;

  @Prop()
  image_url: string;
}

export const GallerySchema = SchemaFactory.createForClass(Gallery);