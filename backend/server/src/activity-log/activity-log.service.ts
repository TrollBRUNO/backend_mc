import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import {
  ActivityAction,
  ActivityEntity,
  ActivityLog,
  ActivityLogDocument,
} from './activity-log.schema';
import { Account, AccountDocument } from '../account/account.schema';
import { Author } from './authorship.service';

export interface ActivityEntry {
  action: ActivityAction;
  entity: ActivityEntity;
  entity_id?: string | null;
  title?: Record<string, string> | Map<string, string> | null;
  casino_id?: Types.ObjectId | string | null;
}

export interface ActivityCounts {
  news: number;
  gallery: number;
  event: number;
  total: number;
}

@Injectable()
export class ActivityLogService {
  constructor(
    @InjectModel(ActivityLog.name)
    private readonly logModel: Model<ActivityLogDocument>,
    @InjectModel(Account.name)
    private readonly accountModel: Model<AccountDocument>,
  ) {}

  // Пишем запись журнала и обновляем last_activity_at автора.
  // Ошибка журналирования не должна ронять сам постинг контента.
  async log(author: Author, entry: ActivityEntry): Promise<void> {
    const now = new Date();

    await this.logModel.create({
      account_id: author.id,
      login: author.login,
      role: author.role,
      action: entry.action,
      entity: entry.entity,
      entity_id: entry.entity_id ?? null,
      title: this.toPlainTitle(entry.title),
      casino_id: entry.casino_id ? new Types.ObjectId(entry.casino_id) : null,
      created_at: now,
    });

    await this.accountModel.updateOne({ _id: author.id }, { last_activity_at: now });
  }

  // title в схемах — Map (мультиязычные заголовки), в журнал кладём обычный объект
  private toPlainTitle(
    title?: Record<string, string> | Map<string, string> | null,
  ): Record<string, string> {
    if (!title) return {};
    if (title instanceof Map) return Object.fromEntries(title);
    return title;
  }

  async find(filter: {
    account_id?: string;
    entity?: ActivityEntity;
    action?: ActivityAction;
    casino_id?: string;
    limit?: number;
    skip?: number;
  }): Promise<{ items: ActivityLog[]; total: number }> {
    const query: FilterQuery<ActivityLogDocument> = {};

    if (filter.account_id) query.account_id = new Types.ObjectId(filter.account_id);
    if (filter.entity) query.entity = filter.entity;
    if (filter.action) query.action = filter.action;
    if (filter.casino_id) query.casino_id = new Types.ObjectId(filter.casino_id);

    const limit = Math.min(Math.max(filter.limit ?? 100, 1), 500);
    const skip = Math.max(filter.skip ?? 0, 0);

    const [items, total] = await Promise.all([
      this.logModel.find(query).sort({ created_at: -1 }).skip(skip).limit(limit).lean(),
      this.logModel.countDocuments(query),
    ]);

    return { items: items as ActivityLog[], total };
  }

  // Последнее действие каждого из аккаунтов — одним запросом
  async lastForAccounts(ids: Types.ObjectId[]): Promise<Map<string, ActivityLog>> {
    if (ids.length === 0) return new Map();

    const rows = await this.logModel.aggregate<{ _id: Types.ObjectId; last: ActivityLog }>([
      { $match: { account_id: { $in: ids } } },
      { $sort: { created_at: -1 } },
      { $group: { _id: '$account_id', last: { $first: '$$ROOT' } } },
    ]);

    return new Map(rows.map(r => [r._id.toString(), r.last]));
  }

  // Сколько всего создано каждым аккаунтом, в разрезе типов
  async createdCountsByAccount(ids: Types.ObjectId[]): Promise<Map<string, ActivityCounts>> {
    if (ids.length === 0) return new Map();

    const rows = await this.logModel.aggregate<{
      _id: { account: Types.ObjectId; entity: ActivityEntity };
      count: number;
    }>([
      { $match: { account_id: { $in: ids }, action: ActivityAction.CREATE } },
      {
        $group: {
          _id: { account: '$account_id', entity: '$entity' },
          count: { $sum: 1 },
        },
      },
    ]);

    const result = new Map<string, ActivityCounts>();

    for (const row of rows) {
      const key = row._id.account.toString();
      const counts = result.get(key) ?? { news: 0, gallery: 0, event: 0, total: 0 };
      counts[row._id.entity] = row.count;
      counts.total += row.count;
      result.set(key, counts);
    }

    return result;
  }
}
