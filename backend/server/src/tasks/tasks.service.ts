import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Account, AccountDocument } from '../account/account.schema';
import { Casino, CasinoDocument } from '../casino/casino.schema';
import { PushService } from '../push/push.service';
import { CasinoService, JackpotResult } from '../casino/casino.service';
import { NotificationLogService } from '../notification-log/notification-log.service';
import { NotificationLogType } from '../notification-log/notification-log.schema';
import { JackpotStateService } from '../jackpot-state/jackpot-state.service';
import {
  JackpotLevels,
  hasAnyLevel,
  levelsFromFeed,
} from '../jackpot-state/jackpot-levels.util';
import { PushType } from '../push/push-locales';
import { AudienceCasino, enabledCasinoIds } from '../jackpot-audience/jackpot-audience.util';

// Уровни джекпота от младшего к старшему. weight решает, о каком из
// одновременно пересечённых уровней сообщить: интереснее всегда старший
const JACKPOT_LEVELS = [
  { name: 'mini' as const,   type: NotificationLogType.JACKPOT_MINI,   push: 'jackpot_mini' as PushType,   weight: 1 },
  { name: 'middle' as const, type: NotificationLogType.JACKPOT_MIDDLE, push: 'jackpot_middle' as PushType, weight: 2 },
  { name: 'mega' as const,   type: NotificationLogType.JACKPOT_MEGA,   push: 'jackpot_mega' as PushType,   weight: 3 },
];

const JACKPOT_LOG_TYPES = JACKPOT_LEVELS.map(l => l.type);

const JACKPOT_MAX_PER_DAY = 2;
const JACKPOT_MIN_GAP_MS = 3 * 60 * 60 * 1000;


// Значения одного источника: что было на прошлом тике и что сейчас.
// Название и город держим мультиязычными: пуш собирается на языке
// каждого получателя, а не на одном общем
interface JackpotSnapshot {
  casinoId: Types.ObjectId;
  name: Record<string, string>;
  city: Record<string, string>;
  address: Record<string, string>;
  previous: JackpotLevels | null;
  current: JackpotLevels;
}

interface Crossing {
  type: NotificationLogType;
  push: PushType;
  weight: number;
  value: number;
  casinoId: Types.ObjectId;
  name: Record<string, string>;
  city: Record<string, string>;
  address: Record<string, string>;
}

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    @InjectModel(Account.name) private accountModel: Model<AccountDocument>,
    @InjectModel(Casino.name) private casinoModel: Model<CasinoDocument>,
    private readonly pushService: PushService,
    private readonly casinoService: CasinoService,
    private readonly notificationLogService: NotificationLogService,
    private readonly jackpotStateService: JackpotStateService,
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
  async removeExpiredCasinoEvents() {
    const now = new Date();

    const result = await this.casinoModel.updateMany(
      { 'events.end': { $lt: now } },
      { $pull: { events: { end: { $lt: now } } } },
    );

    if (result.modifiedCount > 0) {
      this.logger.log(`[events] removed expired events from ${result.modifiedCount} casino(s)`);
    }
  }

  // Каждую минуту — active не редактируется вручную, а прослушивается:
  // становится true, как только наступает start, и обратно false, если
  // start отредактировали на будущее
  @Cron('* * * * *')
  async updateCasinoEventsActiveState() {
    const now = new Date();

    const activated = await this.casinoModel.updateMany(
      { 'events.start': { $lte: now }, 'events.active': { $ne: true } },
      { $set: { 'events.$[e].active': true } },
      { arrayFilters: [{ 'e.start': { $lte: now }, 'e.active': { $ne: true } }] },
    );

    const deactivated = await this.casinoModel.updateMany(
      { 'events.start': { $gt: now }, 'events.active': { $ne: false } },
      { $set: { 'events.$[e].active': false } },
      { arrayFilters: [{ 'e.start': { $gt: now }, 'e.active': { $ne: false } }] },
    );

    if (activated.modifiedCount > 0 || deactivated.modifiedCount > 0) {
      this.logger.log(
        `[events] activated ${activated.modifiedCount}, deactivated ${deactivated.modifiedCount} casino doc(s)`,
      );
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

      await this.pushService.sendLocalized(acc.fcm_token, 'wheel_ready', acc.locale).catch(() => {});

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
            await this.pushService.sendLocalized(a.fcm_token, 'bonus_12h', a.locale).catch(() => {});
            await this.accountModel.updateOne({ _id: a._id }, { bonus_notified_12h: now });
            this.logger.log(`Bonus 12h notify sent to ${a.login}`);
          }
        }

        // 1 час до сгорания
        if (diff <= 60 * 60 * 1000 && diff > 59 * 60 * 1000) {
          const alreadySent = a.bonus_notified_1h &&
            (now.getTime() - a.bonus_notified_1h.getTime()) < 60 * 60 * 1000;
          if (!alreadySent) {
            await this.pushService.sendLocalized(a.fcm_token, 'bonus_1h', a.locale).catch(() => {});
            await this.accountModel.updateOne({ _id: a._id }, { bonus_notified_1h: now });
            this.logger.log(`Bonus 1h notify sent to ${a.login}`);
          }
        }

        return null;
      })
    );
  }

  // Каждые 5 минут: джекпот может пересечь порог и сорваться внутри часа,
  // и при часовом опросе такое пересечение не увидел бы никто
  @Cron('*/5 * * * *')
  async jackpotThresholdCheck() {
    // Проход 1: опрашиваем залы один раз и запоминаем значения.
    // Раньше опрос висел внутри цикла по пользователям, то есть за один тик
    // уходило (юзеры × залы × источники) запросов на внешние серверы
    const casinos = await this.casinoModel.find();
    const snapshots = await this.collectJackpotSnapshots(casinos);
    if (snapshots.length === 0) {
      this.logger.warn('[jackpot] tick: ни один источник не дал значений');
      return;
    }

    // Подбор залов считаем по полному списку, а не по снапшотам: зал,
    // чей источник сейчас лежит, иначе выпал бы из выбора пользователя,
    // цепочка провалилась бы на геопозицию и человек получил бы пуши
    // про соседний город, который не выбирал
    const audience: AudienceCasino[] = casinos.map(casino => ({
      casinoId: String(casino._id),
      name: this.toPlainRecord(casino.name),
      city: this.toPlainRecord(casino.city),
      latitude: casino.latitude,
      longitude: casino.longitude,
    }));

    // Снятые значения под рукой: без них разбор «почему не пришло»
    // упирается в то, что крон вообще ничего о себе не сообщает
    this.logger.debug(
      `[jackpot] tick: ${snapshots
        .map(s => `${this.pick(s.name, 'en')} ${JSON.stringify(s.current)}`)
        .join('; ')}`,
    );

    const users = await this.accountModel.find({
      is_blocked: false,
      fcm_token: { $exists: true, $ne: null },
      'notification_settings.jackpot_enabled': true,
    });

    // Проход 2: по пользователям, уже без единого сетевого запроса
    for (const user of users) {
      await this.notifyUserAboutJackpots(user, snapshots, audience).catch(err =>
        this.logger.error(`[jackpot] ${user.login}: ${err}`),
      );
    }
  }

  // Свежие значения зала рядом с прошлыми, чтобы поймать именно момент
  // пересечения порога, а не факт «сейчас выше»
  private async collectJackpotSnapshots(
    casinos: CasinoDocument[],
  ): Promise<JackpotSnapshot[]> {
    const previous = await this.jackpotStateService.loadAll();

    const snapshots: JackpotSnapshot[] = [];

    for (const casino of casinos) {
      const casinoId = casino._id as unknown as Types.ObjectId;
      const urls = casino.jackpot_url ?? [];
      const results: JackpotResult[] =
        await this.casinoService.getJackpotValuesForCasino(casino);

      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const url = urls[i];
        if (!url) continue;

        if ('error' in result) {
          this.logger.warn(`[jackpot] ${url}: ${result.details}`);
          continue;
        }

        // Названия пулов у залов свои, поэтому уровень определяется
        // порядком, а не именем — см. jackpot-levels.util
        const current = levelsFromFeed(result.jackpots);
        if (!hasAnyLevel(current)) {
          this.logger.warn(`[jackpot] ${url}: пулы без пригодных значений`);
          continue;
        }

        snapshots.push({
          casinoId,
          name: this.toPlainRecord(casino.name),
          city: this.toPlainRecord(casino.city),
          address: this.toPlainRecord(casino.address),
          previous: previous.get(JackpotStateService.key(casinoId, url)) ?? null,
          current,
        });

        await this.jackpotStateService.save(casinoId, url, current);
      }
    }

    return snapshots;
  }

  private async notifyUserAboutJackpots(
    user: AccountDocument,
    snapshots: JackpotSnapshot[],
    audience: AudienceCasino[],
  ): Promise<void> {
    const now = new Date();
    const accountId = user._id as unknown as Types.ObjectId;

    // Предохранитель: не больше двух джекпот-пушей в сутки и не чаще
    // раза в три часа. Основную работу делает пересечение порога,
    // это защита на случай, когда сразу несколько залов дошли до планки
    const sentToday = await this.notificationLogService.countOfTypesSince(
      accountId,
      JACKPOT_LOG_TYPES,
      new Date(now.getTime() - 24 * 60 * 60 * 1000),
    );
    if (sentToday >= JACKPOT_MAX_PER_DAY) return;

    const lastSent = await this.notificationLogService.getLastOfTypes(
      accountId,
      JACKPOT_LOG_TYPES,
    );
    if (lastSent && now.getTime() - lastSent.getTime() < JACKPOT_MIN_GAP_MS) {
      return;
    }

    const crossing = this.findBestCrossing(user, snapshots, audience);
    if (!crossing) return;

    // Пуш называет конкретный зал, его адрес и сумму: теперь мы точно знаем
    // всё это, а раньше слали по всем залам подряд и назвать было нечего
    const casinoName = this.pick(crossing.name, user.locale);
    const place = this.casinoPlace(crossing, user.locale);

    try {
      await this.pushService.sendLocalized(user.fcm_token, crossing.push, user.locale, {
        casino: casinoName,
        address: place,
        amount: this.formatAmount(crossing.value),
      });
    } catch (err) {
      this.logger.error(`[jackpot] ${crossing.type} failed for ${user.login}: ${err}`);
      return;
    }

    await this.notificationLogService.log(accountId, crossing.type, {
      casino_id: String(crossing.casinoId),
      jackpot_value: crossing.value,
    });

    this.logger.log(
      `[jackpot] ${crossing.type} sent to ${user.login} (${casinoName}, ${crossing.value})`,
    );
  }

  // Из всех пересечений выбираем одно, самое крупное: они произошли
  // одновременно, и три пуша подряд об одном зале — это тот самый спам,
  // от которого мы уходим
  private findBestCrossing(
    user: AccountDocument,
    snapshots: JackpotSnapshot[],
    audience: AudienceCasino[],
  ): Crossing | null {
    const thresholds = user.notification_settings.jackpot_thresholds;
    const allowed = enabledCasinoIds(user, audience);

    let best: Crossing | null = null;

    for (const snapshot of snapshots) {
      // Первый замер этого источника: сравнивать не с чем, молчим
      if (!snapshot.previous) continue;
      if (!allowed.has(String(snapshot.casinoId))) continue;

      for (const level of JACKPOT_LEVELS) {
        const threshold = thresholds?.[level.name] ?? 0;

        // Порог 0 — уровень выключен пользователем
        if (threshold <= 0) continue;

        const before = snapshot.previous[level.name];
        const after = snapshot.current[level.name];

        // У источника нет такого уровня (пулов меньше трёх) или замер
        // не состоялся — сравнивать нечего
        if (before === null || after === null) continue;

        // Именно пересечение снизу вверх. Пока джекпот держится выше
        // порога, повторных пушей нет; они вернутся, когда он выпадет
        // и дорастёт до планки заново
        if (!(before < threshold && after >= threshold)) continue;

        if (best && level.weight <= best.weight) continue;

        best = {
          type: level.type,
          push: level.push,
          weight: level.weight,
          value: after,
          casinoId: snapshot.casinoId,
          name: snapshot.name,
          city: snapshot.city,
          address: snapshot.address,
        };
      }
    }

    return best;
  }

  // Мультиязычные поля казино приходят из mongoose то объектом, то Map
  private toPlainRecord(value: unknown): Record<string, string> {
    if (!value) return {};
    return value instanceof Map
      ? (Object.fromEntries(value) as Record<string, string>)
      : (value as Record<string, string>);
  }

  private pick(record: Record<string, string>, locale?: string | null): string {
    const key = (locale ?? '').toLowerCase();
    return record[key] ?? record.bg ?? record.en ?? Object.values(record)[0] ?? '';
  }

  // «бул. Източен 48, Пловдив» на языке получателя пуша
  private casinoPlace(crossing: Crossing, locale?: string | null): string {
    return [
      this.pick(crossing.address, locale),
      this.pick(crossing.city, locale),
    ].filter(Boolean).join(', ');
  }

  // 2540.37 -> «2 540»: разделитель неразрывный, чтобы сумма не переносилась
  // посреди числа, и одинаковый во всех локалях
  private formatAmount(value: number): string {
    return Math.floor(value)
      .toString()
      .replace(/\B(?=(\d{3})+(?!\d))/g, '\u00A0');
  }

  // Ежедневно в 18:00
  @Cron('0 18 * * *')
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

      await this.pushService.sendLocalized(u.fcm_token, 'nightly_reminder', u.locale).catch(() => {});

      await this.notificationLogService.log(accountId, NotificationLogType.NIGHTLY_REMINDER);
      this.logger.log(`[nightly] sent to ${u.login}`);
    }
  }
}
