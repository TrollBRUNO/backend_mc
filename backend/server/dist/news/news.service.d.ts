import { Model } from 'mongoose';
import { News, NewsDocument } from './news.schema';
import { CreateNewsDto } from './dto/create-news.dto';
import { UpdateNewsDto } from './dto/update-news.dto';
export declare class NewsService {
    private newsModel;
    constructor(newsModel: Model<NewsDocument>);
    findAll(): Promise<News[]>;
    findOne(id: string): Promise<News>;
    create(dto: CreateNewsDto): Promise<News>;
    update(id: string, dto: UpdateNewsDto): Promise<News>;
    delete(id: string): Promise<News>;
}
