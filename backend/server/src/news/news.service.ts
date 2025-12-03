import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { News, NewsDocument } from './news.schema';
import { CreateNewsDto } from './dto/create-news.dto';
import { UpdateNewsDto } from './dto/update-news.dto';

@Injectable()
export class NewsService {
  constructor(
    @InjectModel(News.name) private newsModel: Model<NewsDocument>,
  ) {}

  async create(dto: CreateNewsDto): Promise<News> {
    const news = new this.newsModel(dto);
    return news.save();
  }

  async findAll(): Promise<News[]> {
    return this.newsModel.find().sort({ create_date: -1 }).exec();
  }

  async findOne(id: string): Promise<News> {
    const doc = await this.newsModel.findById(id).exec();
    if (!doc) throw new NotFoundException(`News ${id} not found`);
    return doc;
  }   

  async update(id: string, dto: UpdateNewsDto): Promise<News> {
    const updated = await this.newsModel.findByIdAndUpdate(id, dto, { new: true }).exec();
    if (!updated) throw new NotFoundException(`News ${id} not found`);
    return updated;
  }   

  async remove(id: string): Promise<News> {
    const deleted = await this.newsModel.findByIdAndDelete(id).exec();
    if (!deleted) throw new NotFoundException(`News ${id} not found`);
    return deleted;
  }   
}
