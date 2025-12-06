import { Document } from 'mongoose';
export type GalleryDocument = Gallery & Document;
export declare class Gallery {
    description: string;
    create_date: Date;
    image_url: string;
}
export declare const GallerySchema: import("mongoose").Schema<Gallery, import("mongoose").Model<Gallery, any, any, any, Document<unknown, any, Gallery, any, {}> & Gallery & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, Gallery, Document<unknown, {}, import("mongoose").FlatRecord<Gallery>, {}, import("mongoose").ResolveSchemaOptions<import("mongoose").DefaultSchemaOptions>> & import("mongoose").FlatRecord<Gallery> & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}>;
