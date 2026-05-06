import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Account, AccountDocument } from '../account/account.schema';
import { Casino, CasinoDocument } from 'src/casino/casino.schema';
import { PushService } from 'src/push/push.service';
import { CasinoService } from 'src/casino/casino.service';
import { NotificationLogService } from 'src/notification-log/notification-log.service';
import { NotificationLogType } from 'src/notification-log/notification-log.schema';

interface JackpotValues {
  mini: number;
  middle: number;
  mega: number;
}

interface JackpotError {
  error: true;
  message: string;
  details: string;
}

type JackpotResult = JackpotValues | JackpotError;

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    @InjectModel(Account.name) private accountModel: Model<AccountDocument>,
    @InjectModel(Casino.name) private casinoModel: Model<CasinoDocument>,
    private readonly pushService: PushService,
    private readonly casinoService: CasinoService,
    private readonly notificationLogService: NotificationLogService,
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
      acc.bonus_notified_12h = null;
      acc.bonus_notified_1h = null;
      await acc.save();
      this.logger.log(`Bonus reset for ${acc.login}`);
    }
  }

  // Каждую минуту
  @Cron('* * * * *')
  async wheelReadyNotify() {
    const now = new Date();

    const accounts = await this.accountModel.find({
      'notification_settings.wheel_ready': true,
      last_spin_date: { $ne: null },
    });

    for (const acc of accounts) {
      const nextSpin = new Date(acc.last_spin_date.getTime() + 24 * 60 * 60 * 1000);
      if (nextSpin > now) continue;

      const accountId = acc._id as unknown as Types.ObjectId;

      // Не более 3 напоминаний подряд без нового спина
      const sentCount = await this.notificationLogService.countOfTypeSince(
        accountId,
        NotificationLogType.WHEEL_READY,
        acc.last_spin_date,
      );
      if (sentCount >= 3) continue;

      // Не чаще раза в 24ч
      const lastWheel = await this.notificationLogService.getLastOfType(
        accountId,
        NotificationLogType.WHEEL_READY,
      );
      if (lastWheel && now.getTime() - lastWheel.getTime() < 24 * 60 * 60 * 1000) continue;

      await this.pushService.send(acc.fcm_token, {
        title: 'Колесо готово!',
        body: 'Вы можете снова крутить колесо удачи.',
      }).catch(() => {});

      await this.notificationLogService.log(accountId, NotificationLogType.WHEEL_READY);
      this.logger.log(`[wheel] notify sent to ${acc.login}`);
    }
  }

  // Каждую минуту
  @Cron('* * * * *')
  async bonusReminder() {
    const now = new Date();

    const accounts = await this.accountModel.find({
      bonus_balance: { $gt: 0 },
      'notification_settings.bonus_reminder': true,
    });

    await Promise.all(
      accounts.map(async a => {
        const expire = new Date(a.last_spin_date.getTime() + 24 * 60 * 60 * 1000);
        const diff = expire.getTime() - now.getTime();

        // осталось 12–11 часов до сгорания бонуса → напоминаем
        if (diff <= 12 * 60 * 60 * 1000 && diff > 11 * 60 * 60 * 1000) {
          const alreadySent = a.bonus_notified_12h &&
            (now.getTime() - a.bonus_notified_12h.getTime()) < 60 * 60 * 1000;
          if (!alreadySent) {
            await this.pushService.send(a.fcm_token, {
              title: 'Можно забрать бонус!',
              body: 'Не забудьте забрать свой бонус.',
            }).catch(() => {});
            await this.accountModel.updateOne({ _id: a._id }, { bonus_notified_12h: now });
            this.logger.log(`Bonus 12h notify sent to ${a.login}`);
          }
        }

        // 1 час до сгорания
        if (diff <= 60 * 60 * 1000 && diff > 59 * 60 * 1000) {
          const alreadySent = a.bonus_notified_1h &&
            (now.getTime() - a.bonus_notified_1h.getTime()) < 60 * 60 * 1000;
          if (!alreadySent) {
            await this.pushService.send(a.fcm_token, {
              title: 'Бонус скоро сгорит!',
              body: 'У вас остался 1 час, чтобы забрать бонус.',
            }).catch(() => {});
            await this.accountModel.updateOne({ _id: a._id }, { bonus_notified_1h: now });
            this.logger.log(`Bonus 1h notify sent to ${a.login}`);
          }
        }

        return null;
      })
    );
  }

  // Каждый час
  @Cron('0 * * * *')
  async jackpotThresholdCheck() {
    const casinos = await this.casinoModel.find();

    const users = await this.accountModel.find({
      is_blocked: false,
      fcm_token: { $exists: true, $ne: null },
      'notification_settings.jackpot_enabled': true,
    });

    for (const u of users) {
      // TODO гранулярность: сейчас один порог для всех казино.
      // В будущем: читать индивидуальный порог per casino_id
      // и фильтровать notification_logs по casino_id.
      const thresholds = u.notification_settings.jackpot_thresholds;
      const accountId = u._id as unknown as Types.ObjectId;

      for (const casino of casinos) {
        const result: JackpotResult = await this.casinoService.getJackpotValuesForCasino(casino);
        if ('error' in result) continue;

        type JackpotTask = {
          type: NotificationLogType;
          jackpotValue: number;
          promise: Promise<void>;
        };

        const tasks: JackpotTask[] = [];

        if (result.mini >= thresholds.mini) {
          tasks.push({
            type: NotificationLogType.JACKPOT_MINI,
            jackpotValue: result.mini,
            promise: this.pushService.send(u.fcm_token, {
              title: `Mini Jackpot растёт в зале ${casino.city.bg}!`,
              body: `Сейчас: ${result.mini} EUR`,
            }),
          });
        }

        if (result.middle >= thresholds.middle) {
          tasks.push({
            type: NotificationLogType.JACKPOT_MIDDLE,
            jackpotValue: result.middle,
            promise: this.pushService.send(u.fcm_token, {
              title: `Middle Jackpot растёт в зале ${casino.city.bg}!`,
              body: `Сейчас: ${result.middle} EUR`,
            }),
          });
        }

        if (result.mega >= thresholds.mega) {
          tasks.push({
            type: NotificationLogType.JACKPOT_MEGA,
            jackpotValue: result.mega,
            promise: this.pushService.send(u.fcm_token, {
              title: `Mega Jackpot растёт в зале ${casino.city.bg}!`,
              body: `Сейчас: ${result.mega} EUR`,
            }),
          });
        }

        if (tasks.length === 0) continue;

        const results = await Promise.allSettled(tasks.map(t => t.promise));

        for (let i = 0; i < results.length; i++) {
          const settled = results[i];
          const task = tasks[i];
          if (settled.status === 'fulfilled') {
            await this.notificationLogService.log(accountId, task.type, {
              casino_id: (casino._id as any).toString(),
              jackpot_value: task.jackpotValue,
            });
            this.logger.log(`[jackpot] ${task.type} sent to ${u.login} (${casino.city.bg})`);
          } else {
            this.logger.error(`[jackpot] ${task.type} failed for ${u.login}: ${settled.reason}`);
          }
        }
      }
    }
  }

  // Ежедневно в 9:00
  @Cron('0 9 * * *')
  async nightlyReminder() {
    const now = new Date();

    const users = await this.accountModel
      .find({
        is_blocked: false,
        fcm_token: { $exists: true, $ne: null },
        'notification_settings.bonus_reminder': true,
      })
      .select('_id fcm_token login');

    for (const u of users) {
      const accountId = u._id as unknown as Types.ObjectId;

      // Недавно было любое уведомление — не беспокоим
      const lastSent = await this.notificationLogService.getLastSentAt(accountId);
      if (lastSent && now.getTime() - lastSent.getTime() < 48 * 60 * 60 * 1000) {
        continue;
      }

      // 2 nightly подряд без других пушей между ними — замолкаем
      const lastTwo = await this.notificationLogService.getLastN(
        accountId,
        NotificationLogType.NIGHTLY_REMINDER,
        2,
      );
      if (lastTwo.length === 2) {
        const otherAfter = await this.notificationLogService.countOtherTypes(
          accountId,
          NotificationLogType.NIGHTLY_REMINDER,
          lastTwo[1].sent_at, // самое раннее из двух
        );
        if (otherAfter === 0) continue;
      }

      // Слать не чаще раза в 3 дня
      const lastNightly = await this.notificationLogService.getLastOfType(
        accountId,
        NotificationLogType.NIGHTLY_REMINDER,
      );
      if (lastNightly && now.getTime() - lastNightly.getTime() < 3 * 24 * 60 * 60 * 1000) {
        continue;
      }

      await this.pushService.send(u.fcm_token, {
        title: 'Не забывайте!',
        body: 'Загляните в казино — вас ждёт удача!',
      }).catch(() => {});

      await this.notificationLogService.log(accountId, NotificationLogType.NIGHTLY_REMINDER);
      this.logger.log(`[nightly] sent to ${u.login}`);
    }
  }
}
