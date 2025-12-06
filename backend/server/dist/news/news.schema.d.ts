import { Document } from 'mongoose';
export type NewsDocument = News & Document;
export declare class News {
    title: string;
    description: string;
    create_date: Date;
    image_url: string;
}
export declare const NewsSchema: import("mongoose").Schema<News, import("mongoose").Model<News, any, any, any, Document<unknown, any, News, any, {}> & News & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, News, Document<unknown, {}, import("mongoose").FlatRecord<News>, {}, import("mongoose").ResolveSchemaOptions<import("mongoose").DefaultSchemaOptions>> & import("mongoose").FlatRecord<News> & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}>;
