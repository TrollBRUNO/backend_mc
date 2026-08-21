import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  NotificationLog,
  NotificationLogDocument,
  NotificationLogType,
} from './notification-log.schema';

@Injectable()
export class NotificationLogService {
  constructor(
    @InjectModel(NotificationLog.name)
    private readonly logModel: Model<NotificationLogDocument>,
  ) {}

  async log(
    accountId: Types.ObjectId,
    type: NotificationLogType,
    meta?: { casino_id?: string; jackpot_value?: number },
  ): Promise<void> {
    await this.logModel.create({ account_id: accountId, type, sent_at: new Date(), meta });
  }

  async getLastSentAt(accountId: Types.ObjectId): Promise<Date | null> {
    const doc = await this.logModel
      .findOne({ account_id: accountId })
      .sort({ sent_at: -1 })
      .select('sent_at')
      .lean()
      .exec();
    return doc ? doc.sent_at : null;
  }

  async getLastOfType(
    accountId: Types.ObjectId,
    type: NotificationLogType,
  ): Promise<Date | null> {
    const doc = await this.logModel
      .findOne({ account_id: accountId, type })
      .sort({ sent_at: -1 })
      .select('sent_at')
      .lean()
      .exec();
    return doc ? doc.sent_at : null;
  }

  async getLastN(
    accountId: Types.ObjectId,
    type: NotificationLogType,
    n: number,
  ): Promise<NotificationLogDocument[]> {
    return this.logModel
      .find({ account_id: accountId, type })
      .sort({ sent_at: -1 })
      .limit(n)
      .exec();
  }

  async countOtherTypes(
    accountId: Types.ObjectId,
    excludeType: NotificationLogType,
    since: Date,
  ): Promise<number> {
    return this.logModel
      .countDocuments({
        account_id: accountId,
        type: { $ne: excludeType },
        sent_at: { $gte: since },
      })
      .exec();
  }

  // Джекпот-пуши ограничиваются не по одному типу, а всей группой сразу:
  // для человека mini, middle и mega — это одно и то же уведомление о зале
  async getLastOfTypes(
    accountId: Types.ObjectId,
    types: NotificationLogType[],
  ): Promise<Date | null> {
    const doc = await this.logModel
      .findOne({ account_id: accountId, type: { $in: types } })
      .sort({ sent_at: -1 })
      .select('sent_at')
      .lean()
      .exec();
    return doc ? doc.sent_at : null;
  }

  async countOfTypesSince(
    accountId: Types.ObjectId,
    types: NotificationLogType[],
    since: Date,
  ): Promise<number> {
    return this.logModel
      .countDocuments({
        account_id: accountId,
        type: { $in: types },
        sent_at: { $gte: since },
      })
      .exec();
  }

  async countOfTypeSince(
    accountId: Types.ObjectId,
    type: NotificationLogType,
    since: Date,
  ): Promise<number> {
    return this.logModel
      .countDocuments({
        account_id: accountId,
        type,
        sent_at: { $gte: since },
      })
      .exec();
  }
}
