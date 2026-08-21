import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  JackpotState,
  JackpotStateDocument,
} from './jackpot-state.schema';

export interface JackpotLevels {
  mini: number;
  middle: number;
  mega: number;
}

@Injectable()
export class JackpotStateService {
  constructor(
    @InjectModel(JackpotState.name)
    private readonly stateModel: Model<JackpotStateDocument>,
  ) {}

  // Ключ, под которым состояние лежит в Map: зал плюс конкретный источник
  static key(casinoId: Types.ObjectId | string, sourceUrl: string): string {
    return `${String(casinoId)}::${sourceUrl}`;
  }

  // Всё состояние разом: крон обходит залы одним проходом, поштучные
  // запросы на каждый источник тут только мешали бы
  async loadAll(): Promise<Map<string, JackpotLevels>> {
    const docs = await this.stateModel.find().lean();

    const result = new Map<string, JackpotLevels>();

    for (const doc of docs) {
      // Источник, ни разу не отдавший корректных данных, prev не образует
      if (doc.mini == null || doc.middle == null || doc.mega == null) continue;

      result.set(JackpotStateService.key(doc.casino_id, doc.source_url), {
        mini: doc.mini,
        middle: doc.middle,
        mega: doc.mega,
      });
    }

    return result;
  }

  async save(
    casinoId: Types.ObjectId,
    sourceUrl: string,
    levels: JackpotLevels,
  ): Promise<void> {
    await this.stateModel.updateOne(
      { casino_id: casinoId, source_url: sourceUrl },
      { $set: { ...levels, updated_at: new Date() } },
      { upsert: true },
    );
  }
}
