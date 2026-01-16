import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Account, AccountDocument } from '../account/account.schema';
import { Model } from 'mongoose';

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    @InjectModel(Account.name) private accountModel: Model<AccountDocument>,
  ) {}

  // Каждую минуту
  @Cron('* * * * *')
  async resetExpiredBonuses() {
    const now = new Date();
    const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const expired = await this.accountModel.find({
      bonus_balance: { $gt: 0 },
      last_spin_date: { $lt: cutoff },
    });

    for (const acc of expired) {
      acc.bonus_balance = 0 as any;
      await acc.save();
      this.logger.log(`Bonus reset for ${acc.login}`);
    }
  }
}
