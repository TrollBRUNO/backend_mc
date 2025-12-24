import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Statistics, StatisticsDocument } from './statistics.schema';
import { Account, AccountDocument } from '../account/account.schema';
import { CreateStatisticsDto } from './dto/create-statistics.dto';
import { UpdateStatisticsDto } from './dto/update-statistics.dto';

@Injectable()
export class StatisticsService {
  constructor(
    @InjectModel(Statistics.name) private statisticsModel: Model<StatisticsDocument>,
    @InjectModel(Account.name) private accountModel: Model<AccountDocument>,
  ) {}

  async findAll(): Promise<Statistics[]> {
    return this.statisticsModel.find().sort({ spin_date: -1 }).exec();
  }

  async findOne(id: string): Promise<Statistics> {
    const doc = await this.statisticsModel.findById(id).exec();
    if (!doc) throw new NotFoundException(`Statistics ${id} not found`);
    return doc;
  }  

  async create(dto: CreateStatisticsDto): Promise<Statistics> {
    const statistics = new this.statisticsModel(dto);
    return statistics.save();
  } 

  async update(id: string, dto: UpdateStatisticsDto): Promise<Statistics> {
    const updated = await this.statisticsModel.findByIdAndUpdate(id, dto, { new: true }).exec();
    if (!updated) throw new NotFoundException(`Statistics ${id} not found`);
    return updated;
  }   

  async delete(id: string): Promise<Statistics> {
    const deleted = await this.statisticsModel.findByIdAndDelete(id).exec();
    if (!deleted) throw new NotFoundException(`Statistics ${id} not found`);
    return deleted;
  }   

  async getStatistics(accountId: string) {
    const account = await this.accountModel.findById(accountId);
    if (!account) throw new NotFoundException('Account not found');

    const stats = await this.statisticsModel
      .find({ user_id: accountId })
      .sort({ spin_date: -1 })
      .exec();

    return {
      total_spins: stats.length,
      history: stats.map(s => ({
        spin_date: s.spin_date,
        prize_count: s.prize_count,
      })),
    };
  }
}
