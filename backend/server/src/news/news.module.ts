import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { News, NewsSchema } from './news.schema';
import { NewsService } from './news.service';
import { NewsController } from './news.controller';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: News.name, schema: NewsSchema }])
  ],
  providers: [NewsService],
  controllers: [NewsController]
})
export class NewsModule {}
