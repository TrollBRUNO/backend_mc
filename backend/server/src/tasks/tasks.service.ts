import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Account, AccountDocument } from '../account/account.schema';
import { Model } from 'mongoose';
import { PushService } from 'src/push/push.service';
import { CasinoService } from 'src/casino/casino.service';

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    @InjectModel(Account.name) private accountModel: Model<AccountDocument>,
    private readonly pushService: PushService,
    private readonly casinoService: CasinoService,
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

  // каждую минуту
  @Cron('* * * * *') 
  async wheelReadyNotify() {
    const now = new Date();

    const accounts = await this.accountModel.find({
      'notification_settings.wheel_ready': true,
      last_spin_date: { $ne: null },
    });

    for (const acc of accounts) {
      const nextSpin = new Date(acc.last_spin_date.getTime() + 24 * 60 * 60 * 1000);

      if (nextSpin <= now) {
        await this.pushService.send(acc.fcm_token, {
          title: 'Колесо готово!',
          body: 'Вы можете снова крутить колесо удачи.',
        });
      }
    }
  }

  // каждую минуту
  @Cron('* * * * *')
  async bonusReminder() {
    const now = new Date();

    const accounts = await this.accountModel.find({
      bonus_balance: { $gt: 0 },
      'notification_settings.bonus_reminder': true,
    });

    for (const acc of accounts) {
      const expire = new Date(acc.last_spin_date.getTime() + 24 * 60 * 60 * 1000);
      const diff = expire.getTime() - now.getTime();

      if (diff < 60 * 60 * 1000 && diff > 0) {
        await this.pushService.send(acc.fcm_token, {
          title: 'Бонус скоро сгорит!',
          body: 'У вас остался 1 час, чтобы забрать бонус.',
        });
      }
    }
  }

  // каждую минуту
  @Cron('* * * * *')
  async jackpotThresholdCheck() {
    const jackpot = await this.casinoService.getJackpotValues('MAIN');

    if (jackpot.error) {
      this.logger.warn('Jackpot fetch failed');
      return;
    }

    const users = await this.accountModel.find({
      'notification_settings.jackpot_thresholds': { $exists: true },
    });

    for (const u of users) {
      const t = u.notification_settings.jackpot_thresholds;

      if (jackpot.mini > t.mini) {
        await this.pushService.send(u.fcm_token, {
          title: 'Mini Jackpot растёт!',
          body: `Сейчас: ${jackpot.mini} EUR`,
        });
      }

      if (jackpot.middle > t.middle) {
        await this.pushService.send(u.fcm_token, {
          title: 'Middle Jackpot растёт!',
          body: `Сейчас: ${jackpot.middle} EUR`,
        });
      }

      if (jackpot.mega > t.mega) {
        await this.pushService.send(u.fcm_token, {
          title: 'Mega Jackpot растёт!',
          body: `Сейчас: ${jackpot.mega} EUR`,
        });
      }
    }
  }

  // Ежедневно в 21:00
  @Cron('0 21 * * *')
  async nightlyReminder() {
    const users = await this.accountModel.find().select('_id fcm_token');
    for (const user of users) {
      await this.pushService.send(user.fcm_token, {
        title: 'Не забывайте!',
        body: 'Загляните в казино — вас ждёт удача!',
      });
    }
  }
}
