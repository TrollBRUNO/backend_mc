import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type StatisticsDocument = Statistics & Document;

// Откуда выигрыш: прокрутка колеса или демо-прокрутка до регистрации
export type SpinSource = 'spin' | 'demo';

// Что стало с выигрышем: ждёт кассы, забран по бонус-коду или сгорел
// через 24 часа после прокрутки
export type SpinStatus = 'pending' | 'claimed' | 'expired';

// Одна прокрутка колеса — она же строка истории в профиле игрока
@Schema()
export class Statistics {
  @Prop()
  spin_date: Date;

  @Prop()
  prize_count: number;

  @Prop()
  user_id: string;

  // У записей до появления учёта нет ни source, ни status: source считаем
  // прокруткой, а «забрали / сгорело» для них неизвестно — этих данных
  // тогда не сохраняли
  @Prop({ type: String, default: null })
  source: SpinSource | null;

  @Prop({ type: String, default: null })
  status: SpinStatus | null;

  // Погашение на кассе: когда и по какой карте. Зал — тот, где
  // зарегистрирована карта
  @Prop({ type: Date, default: null })
  claimed_at: Date | null;

  @Prop({ type: String, default: null })
  claimed_card_id: string | null;

  @Prop({ type: Types.ObjectId, ref: 'Casino', default: null })
  claimed_casino_id: Types.ObjectId | null;

  @Prop({ type: Date, default: null })
  expired_at: Date | null;
}

export const StatisticsSchema = SchemaFactory.createForClass(Statistics);

// История игрока и погашение его ожидающих выигрышей
StatisticsSchema.index({ user_id: 1, status: 1 });
// Сводка за период и ежеминутное сжигание просроченных
StatisticsSchema.index({ status: 1, spin_date: 1 });
StatisticsSchema.index({ spin_date: 1 });
