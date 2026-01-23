import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Account, AccountDocument } from '../account/account.schema';
import { Model } from 'mongoose';
import { PushService } from 'src/push/push.service';
import { CasinoService } from 'src/casino/casino.service';
import { Casino, CasinoDocument } from 'src/casino/casino.schema';

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    @InjectModel(Account.name) private accountModel: Model<AccountDocument>,
    @InjectModel(Casino.name) private casinoModel: Model<CasinoDocument>,
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

    await Promise.all(
      accounts.map(async acc => {
        const nextSpin = new Date(acc.last_spin_date.getTime() + 24 * 60 * 60 * 1000);

        if (nextSpin > now) {
          return null;
        }

        if (acc.last_wheel_notify && now.getTime() - acc.last_wheel_notify.getTime() < 24 * 60 * 60 * 1000){ 
          return null;
        }

        await this.pushService.send(acc.fcm_token, {
          title: 'Колесо готово!',
          body: 'Вы можете снова крутить колесо удачи.',
        }).catch(() => {});

        acc.last_wheel_notify = now; 
        await acc.save();
        
        return null;
      }),
    );
  }

  // каждую минуту
  @Cron('* * * * *')
  async bonusReminder() {
    const now = new Date();

    const accounts = await this.accountModel.find({
      bonus_balance: { $gt: 0 },
      'notification_settings.bonus_reminder': true,
    });

    await Promise.all(
      accounts.map(a => {
        const expire = new Date(a.last_spin_date.getTime() + 24 * 60 * 60 * 1000);
        const diff = expire.getTime() - now.getTime();

        // 12 часов прошло → можно забрать бонус
        if (diff <= 12 * 60 * 60 * 1000 && diff > 11 * 60 * 60 * 1000) {
          this.pushService.send(a.fcm_token, {
            title: 'Можно забрать бонус!',
            body: 'Не забудьте забрать свой бонус.',
          }).catch(() => {});
        }

        // 1 час до сгорания
        if (diff <= 60 * 60 * 1000 && diff > 59 * 60 * 1000) {
          this.pushService.send(a.fcm_token, {
            title: 'Бонус скоро сгорит!',
            body: 'У вас остался 1 час, чтобы забрать бонус.',
          }).catch(() => {});
        }

        return null;
      })
    );
  }

  // каждую минуту
  @Cron('* * * * *')
  async jackpotThresholdCheck() {
    const now = new Date();

    const casinos = await this.casinoModel.find();

    const users = await this.accountModel.find({
      'notification_settings.jackpot_thresholds': { $exists: true },
    });

   await Promise.all(
      users.map(async u => {
        if (u.last_jackpot_notify && now.getTime() - u.last_jackpot_notify.getTime() < 60 * 60 * 1000){ 
          return null;
        }

        const t = u.notification_settings.jackpot_thresholds;

        for (const casino of casinos) { 
          const jackpot = await this.casinoService.getJackpotValuesForCasino(casino);

          if (jackpot.error) continue;

          const tasks: Promise<void>[] = [];

          if (jackpot.mini > t.mini) {
            tasks.push(
              this.pushService.send(u.fcm_token, {
                title: `Mini Jackpot растёт в зале ${casino.city.bg}!`,
                body: `Сейчас: ${jackpot.mini} EUR`,
              }).catch(() => {}),
            );
          }

          if (jackpot.middle > t.middle) {
            tasks.push(
              this.pushService.send(u.fcm_token, {
                title: `Middle Jackpot растёт в зале ${casino.city.bg}!`,
                body: `Сейчас: ${jackpot.middle} EUR`,
              }).catch(() => {}),
            );
          }

          if (jackpot.mega > t.mega) {
            tasks.push(
              this.pushService.send(u.fcm_token, {
                title: `Mega Jackpot растёт в зале ${casino.city.bg}!`,
                body: `Сейчас: ${jackpot.mega} EUR`,
              }).catch(() => {}),
            );
          }

          if (tasks.length > 0) {
            Promise.all(tasks);
            u.last_jackpot_notify = now;
            u.save();
          }
        }
        
        return null;
      }),
    );
  }

  // Ежедневно в 21:00
  @Cron('0 21 * * *')
  async nightlyReminder() {
    const users = await this.accountModel.find().select('_id fcm_token');

    await Promise.all(
      users.map(u =>
        this.pushService.send(u.fcm_token, {
          title: 'Не забывайте!',
          body: 'Загляните в казино — вас ждёт удача!',
        }).catch(() => {}),
      ),
    );
  }
}
