import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type JackpotSettingsDocument = JackpotSettings & Document;

// Границы одной шкалы порога в приложении.
//
// Пулы у залов живут в совершенно разных масштабах: Mini в Пловдиве это
// 50-100 EUR, а MEGA в Кирково — 2500-4000. Зашитые в приложение 0-10000
// позволяли выставить порог, который не сработает никогда, и человек об
// этом не узнавал. Теперь рамки задаёт админ и меняет их, когда меняются залы
@Schema({ _id: false })
export class ThresholdRange {
  @Prop({ type: Number, required: true })
  min: number;

  @Prop({ type: Number, required: true })
  max: number;

  // Шаг, по которому встаёт значение при перетаскивании пальцем. Кнопки
  // «−» и «+» ходят по единице независимо от него
  @Prop({ type: Number, required: true })
  step: number;
}

export const ThresholdRangeSchema = SchemaFactory.createForClass(ThresholdRange);

// Настройка одна на всё приложение, документ в коллекции ровно один
@Schema({ collection: 'jackpotsettings' })
export class JackpotSettings {
  @Prop({ type: ThresholdRangeSchema, required: true })
  mini: ThresholdRange;

  @Prop({ type: ThresholdRangeSchema, required: true })
  middle: ThresholdRange;

  @Prop({ type: ThresholdRangeSchema, required: true })
  mega: ThresholdRange;

  @Prop({ type: Date, default: Date.now })
  updated_at: Date;
}

export const JackpotSettingsSchema = SchemaFactory.createForClass(JackpotSettings);

// То, что было зашито в mystery_notification_widget.dart. Пока админ ничего
// не менял, приложение ведёт себя ровно как раньше
export const DEFAULT_JACKPOT_SETTINGS = {
  mini: { min: 0, max: 1000, step: 5 },
  middle: { min: 0, max: 5000, step: 10 },
  mega: { min: 0, max: 10000, step: 25 },
};

export const JACKPOT_LEVELS = ['mini', 'middle', 'mega'] as const;
export type JackpotLevelName = (typeof JACKPOT_LEVELS)[number];

/**
 * Порог, приведённый к рамкам шкалы.
 *
 * Ноль не поднимаем до `min`: это выключенный уровень, и поднять его
 * значило бы включить человеку уведомления, которые он выключил сам.
 */
export function clampThreshold(value: unknown, range: ThresholdRange): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return 0;

  const rounded = Math.round(parsed);
  if (rounded <= 0) return 0;

  return Math.min(Math.max(rounded, range.min), range.max);
}
