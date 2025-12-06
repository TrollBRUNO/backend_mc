import { NewsService } from './news.service';
export declare class NewsController {
    private readonly newsService;
    constructor(newsService: NewsService);
    findAll(): Promise<import("./news.schema").News[]>;
    findOne(id: string): Promise<import("./news.schema").News>;
    create(file: any, body: any): Promise<import("./news.schema").News>;
    createJson(body: any): Promise<import("./news.schema").News>;
    update(id: string, file: any, body: any): Promise<import("./news.schema").News>;
    delete(id: string): Promise<import("./news.schema").News>;
}
