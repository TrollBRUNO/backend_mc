import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import {
  SpinSource,
  Statistics,
  StatisticsDocument,
} from './statistics.schema';
import { Casino, CasinoDocument } from '../casino/casino.schema';
import { Wheel, WheelDocument } from '../wheel/wheel.schema';

// Выигрыш сгорает через сутки после прокрутки — то же правило, что
// у TasksService.resetExpiredBonuses
export const SPIN_PRIZE_TTL_MS = 24 * 60 * 60 * 1000;

export interface SummaryCounts {
  count: number;
  sum: number;
  claimed: number;
  claimed_sum: number;
  expired: number;
  expired_sum: number;
  pending: number;
  pending_sum: number;
  unknown: number;
  unknown_sum: number;
}

// Учёт выигрышей колеса: что выпало, что забрали на кассе, что сгорело.
// Пишут сюда прокрутка, касса и ежеминутный cron; читает админка
@Injectable()
export class WheelStatsService {
  constructor(
    @InjectModel(Statistics.name)
    private readonly statModel: Model<StatisticsDocument>,
    @InjectModel(Casino.name)
    private readonly casinoModel: Model<CasinoDocument>,
    @InjectModel(Wheel.name)
    private readonly wheelModel: Model<WheelDocument>,
  ) {}

  async recordSpin(accountId: string, prize: number, source: SpinSource, at: Date) {
    await this.statModel.create({
      user_id: accountId,
      prize_count: prize,
      spin_date: at,
      source,
      status: 'pending',
    });
  }

  // Касса гасит бонус-код и обнуляет весь бонусный баланс — значит,
  // забраны все ожидающие выигрыши игрока (обычно один, с демо — два)
  async markClaimed(
    accountId: string,
    card: { card_id: string; casino_id?: Types.ObjectId | string | null },
    at: Date = new Date(),
  ) {
    await this.statModel.updateMany(
      { user_id: accountId, status: 'pending' },
      {
        $set: {
          status: 'claimed',
          claimed_at: at,
          claimed_card_id: card.card_id,
          claimed_casino_id: card.casino_id ? new Types.ObjectId(String(card.casino_id)) : null,
        },
      },
    );
  }

  // Не забранное за сутки сгорело. Отдельный проход по самим записям,
  // а не по аккаунтам: так сгорит и выигрыш, чей баланс обнулили
  // как-то иначе (например, руками в админке)
  async expireStale(at: Date = new Date()) {
    const result = await this.statModel.updateMany(
      { status: 'pending', spin_date: { $lt: new Date(at.getTime() - SPIN_PRIZE_TTL_MS) } },
      { $set: { status: 'expired', expired_at: at } },
    );
    return result.modifiedCount;
  }

  // Сводка по значениям колеса за период [from, to): сколько выпало,
  // забрали, сгорело, ждёт и неизвестно — отдельно для колеса и демо
  async summary(from?: Date, to?: Date) {
    const match: Record<string, unknown> = {};
    if (from || to) {
      match.spin_date = {
        ...(from ? { $gte: from } : {}),
        ...(to ? { $lt: to } : {}),
      };
    }

    const countIf = (status: string, field: 1 | '$prize_count') => ({
      $sum: { $cond: [{ $eq: ['$status_', status] }, field, 0] },
    });

    const grouped = await this.statModel.aggregate([
      { $match: match },
      {
        $project: {
          prize_count: 1,
          source_: { $ifNull: ['$source', 'spin'] },
          status_: { $ifNull: ['$status', 'unknown'] },
        },
      },
      {
        $group: {
          _id: { source: '$source_', prize: '$prize_count' },
          count: { $sum: 1 },
          sum: { $sum: '$prize_count' },
          claimed: countIf('claimed', 1),
          claimed_sum: countIf('claimed', '$prize_count'),
          expired: countIf('expired', 1),
          expired_sum: countIf('expired', '$prize_count'),
          pending: countIf('pending', 1),
          pending_sum: countIf('pending', '$prize_count'),
          unknown: countIf('unknown', 1),
          unknown_sum: countIf('unknown', '$prize_count'),
        },
      },
      { $sort: { '_id.source': -1, '_id.prize': 1 } },
    ]);

    const rows = grouped.map(({ _id, ...counts }) => ({
      source: _id.source as SpinSource,
      prize: _id.prize as number,
      ...(counts as SummaryCounts),
    }));

    const byCasino = await this.statModel.aggregate([
      { $match: { ...match, status: 'claimed' } },
      {
        $group: {
          _id: '$claimed_casino_id',
          claimed: { $sum: 1 },
          claimed_sum: { $sum: '$prize_count' },
        },
      },
      { $sort: { claimed_sum: -1 } },
    ]);

    const labels = await this.casinoLabels(byCasino.map(c => c._id));

    // С какого момента ведётся учёт «забрали / сгорело»: всё раньше —
    // «неизвестно»
    const firstTracked = await this.statModel
      .findOne({ status: { $ne: null } })
      .sort({ spin_date: 1 })
      .select('spin_date')
      .lean();

    const wheelValues = (await this.wheelModel.find().lean())
      .map(w => w.value)
      .filter(v => typeof v === 'number');

    return {
      from: from ?? null,
      to: to ?? null,
      tracking_since: firstTracked?.spin_date ?? null,
      // Текущее колесо: значение не из него в сводке — из старого колеса
      // или подделанной прокрутки
      wheel_values: [...new Set(wheelValues)].sort((a, b) => a - b),
      rows,
      totals: {
        spin: this.total(rows.filter(r => r.source === 'spin')),
        demo: this.total(rows.filter(r => r.source === 'demo')),
      },
      by_casino: byCasino.map(c => ({
        casino_id: c._id ? String(c._id) : null,
        casino: c._id ? labels.get(String(c._id)) ?? '—' : '—',
        claimed: c.claimed,
        claimed_sum: c.claimed_sum,
      })),
    };
  }

  // История прокруток игрока для «Подробнее» в админке. Игроку в профиль
  // идёт StatisticsService.getStatistics — там статуса нет, так решили
  async accountHistory(accountId: string, limit = 200) {
    const [total, spins] = await Promise.all([
      this.statModel.countDocuments({ user_id: accountId }),
      this.statModel.find({ user_id: accountId }).sort({ spin_date: -1 }).limit(limit).lean(),
    ]);

    const labels = await this.casinoLabels(spins.map(s => s.claimed_casino_id));

    return {
      total,
      spins: spins.map(s => ({
        spin_date: s.spin_date,
        prize: s.prize_count,
        source: s.source ?? 'spin',
        status: s.status ?? 'unknown',
        claimed_at: s.claimed_at ?? null,
        claimed_card_id: s.claimed_card_id ?? null,
        claimed_casino: s.claimed_casino_id
          ? labels.get(String(s.claimed_casino_id)) ?? '—'
          : null,
        expired_at: s.expired_at ?? null,
      })),
    };
  }

  private total(rows: SummaryCounts[]): SummaryCounts {
    const keys: (keyof SummaryCounts)[] = [
      'count', 'sum', 'claimed', 'claimed_sum', 'expired', 'expired_sum',
      'pending', 'pending_sum', 'unknown', 'unknown_sum',
    ];
    return Object.fromEntries(
      keys.map(key => [key, rows.reduce((acc, row) => acc + (row[key] ?? 0), 0)]),
    ) as unknown as SummaryCounts;
  }

  // «Название — город» на английском, а где его нет — на болгарском
  private async casinoLabels(ids: unknown[]): Promise<Map<string, string>> {
    const unique = [...new Set(ids.filter(Boolean).map(String))];
    if (!unique.length) return new Map();

    const casinos = await this.casinoModel
      .find({ _id: { $in: unique } })
      .select('name city')
      .lean();

    // Мультиязычное поле приходит то объектом, то Map, а у старых залов —
    // просто строкой
    const pick = (value: unknown): string => {
      if (!value) return '';
      if (typeof value === 'string') return value;
      const plain =
        value instanceof Map
          ? (Object.fromEntries(value) as Record<string, string>)
          : (value as Record<string, string>);
      return plain.en ?? plain.bg ?? Object.values(plain)[0] ?? '';
    };

    return new Map(
      casinos.map(c => {
        const label = [pick(c.name), pick(c.city)].filter(Boolean).join(' — ');
        return [String(c._id), label || '—'];
      }),
    );
  }
}
