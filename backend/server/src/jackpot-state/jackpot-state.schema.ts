import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type JackpotStateDocument = JackpotState & Document;

// Последнее известное значение джекпотов одного источника.
//
// Нужно, чтобы отличить «джекпот дорос до порога прямо сейчас» от «висит
// выше порога уже месяц». Без этого условие «значение >= порога» истинно
// месяцами подряд и пуш уходит на каждом тике крона.
@Schema()
export class JackpotState {
  @Prop({ type: Types.ObjectId, ref: 'Casino', required: true, index: true })
  casino_id: Types.ObjectId;

  // Ключом служит сам url, а не его номер в casino.jackpot_url: если админ
  // переставит источники местами, номера съедут и мы начнём сравнивать
  // значения одного зала со значениями другого
  @Prop({ type: String, required: true })
  source_url: string;

  @Prop({ type: Number, default: null })
  mini: number | null;

  @Prop({ type: Number, default: null })
  middle: number | null;

  @Prop({ type: Number, default: null })
  mega: number | null;

  @Prop({ type: Date, default: Date.now })
  updated_at: Date;
}

export const JackpotStateSchema = SchemaFactory.createForClass(JackpotState);

JackpotStateSchema.index({ casino_id: 1, source_url: 1 }, { unique: true });
