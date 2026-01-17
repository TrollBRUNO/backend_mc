import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { News, NewsSchema } from './news.schema';
import { NewsService } from './news.service';
import { NewsController } from './news.controller';
import { Account, AccountSchema } from 'src/account/account.schema';
import { PushService } from 'src/push/push.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: News.name, schema: NewsSchema },
      { name: Account.name, schema: AccountSchema },
    ])
  ],
  providers: [NewsService, PushService],
  controllers: [NewsController]
})
export class NewsModule {}
