import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { News, NewsDocument } from './news.schema';
import { CreateNewsDto } from './dto/create-news.dto';
import { UpdateNewsDto } from './dto/update-news.dto';
import { Account, AccountDocument } from 'src/account/account.schema';
import { PushService } from 'src/push/push.service';
import e from 'express';

@Injectable()
export class NewsService {
  constructor(
    @InjectModel(News.name) private newsModel: Model<NewsDocument>,
    @InjectModel(Account.name) private accountModel: Model<AccountDocument>,
    private readonly pushService: PushService,
  ) {}

  async findAll(): Promise<News[]> {
    return this.newsModel.find().sort({ create_date: -1 }).exec();
  }

  async findOne(id: string): Promise<News> {
    const doc = await this.newsModel.findById(id).exec();
    if (!doc) throw new NotFoundException(`News ${id} not found`);
    return doc;
  }  

  async create(dto: CreateNewsDto): Promise<News> {
    const now = new Date();

    const news = new this.newsModel(dto);

    const users = await this.accountModel.find({ 'notification_settings.news_post': true, }); 

    await Promise.all(
      users.map(u => {
        if (u.last_new_notify && now.getTime() - u.last_new_notify.getTime() < 24 * 60 * 60 * 1000) { 
          return null;
        }

        this.pushService.send(u.fcm_token, {
          title: 'Новая новость!',
          body: 'В галерее появился новый пост.',
        }).catch(() => {}),

        u.last_new_notify = now; 
        u.save();
      }),
    );

    return news.save();
  } 

  async update(id: string, dto: UpdateNewsDto): Promise<News> {
    const updated = await this.newsModel.findByIdAndUpdate(id, dto, { new: true }).exec();
    if (!updated) throw new NotFoundException(`News ${id} not found`);
    return updated;
  }   

  async delete(id: string): Promise<News> {
    const deleted = await this.newsModel.findByIdAndDelete(id).exec();
    if (!deleted) throw new NotFoundException(`News ${id} not found`);
    return deleted;
  }   
}
