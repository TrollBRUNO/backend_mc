import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  DEFAULT_JACKPOT_SETTINGS,
  JACKPOT_LEVELS,
  JackpotLevelName,
  JackpotSettings,
  JackpotSettingsDocument,
  ThresholdRange,
} from './jackpot-settings.schema';
import {
  ThresholdRangeDto,
  UpdateJackpotSettingsDto,
} from './dto/update-jackpot-settings.dto';
import { Account, AccountDocument } from '../account/account.schema';

type Level = JackpotLevelName;

export interface JackpotSettingsView {
  mini: ThresholdRange;
  middle: ThresholdRange;
  mega: ThresholdRange;
}

// Сколько порогов пришлось подрезать под новые рамки — админке есть
// что показать, а в логе видно, что правка задела живые настройки
export interface JackpotSettingsUpdateResult extends JackpotSettingsView {
  adjusted: number;
}

@Injectable()
export class JackpotSettingsService {
  private readonly logger = new Logger(JackpotSettingsService.name);

  constructor(
    @InjectModel(JackpotSettings.name)
    private readonly settingsModel: Model<JackpotSettingsDocument>,
    @InjectModel(Account.name)
    private readonly accountModel: Model<AccountDocument>,
  ) {}

  // Документа может не быть вовсе — отдаём умолчания, не создавая его.
  // Иначе каждый запуск приложения писал бы в базу ради чтения
  async get(): Promise<JackpotSettingsView> {
    const doc = await this.settingsModel.findOne().lean();
    if (!doc) return { ...DEFAULT_JACKPOT_SETTINGS };

    // Уровень, добавленный после того, как документ уже лежал в базе,
    // берёт значения из умолчаний, а не роняет экран настроек
    return {
      mini: doc.mini ?? DEFAULT_JACKPOT_SETTINGS.mini,
      middle: doc.middle ?? DEFAULT_JACKPOT_SETTINGS.middle,
      mega: doc.mega ?? DEFAULT_JACKPOT_SETTINGS.mega,
    };
  }

  async update(dto: UpdateJackpotSettingsDto): Promise<JackpotSettingsUpdateResult> {
    const update: JackpotSettingsView = {
      mini: this.validate('mini', dto?.mini),
      middle: this.validate('middle', dto?.middle),
      mega: this.validate('mega', dto?.mega),
    };

    await this.settingsModel.updateOne(
      {},
      { $set: { ...update, updated_at: new Date() } },
      { upsert: true },
    );

    const adjusted = await this.fitExistingThresholds(update);

    return { ...update, adjusted };
  }

  /**
   * Подрезать уже сохранённые пороги под новые рамки.
   *
   * Админ сузил mega до 5000 — у всех, у кого стояло 7475, становится 5000.
   * Без этого такой порог остался бы жить в базе: на шкале его не видно,
   * а крон продолжал бы сравнивать джекпот с числом, до которого тот
   * никогда не дорастёт.
   *
   * Ноль не трогаем ни при каких рамках — это выключенный уровень.
   */
  private async fitExistingThresholds(ranges: JackpotSettingsView): Promise<number> {
    let adjusted = 0;

    for (const level of JACKPOT_LEVELS) {
      const field = `notification_settings.jackpot_thresholds.${level}`;
      const { min, max } = ranges[level];

      const above = await this.accountModel.updateMany(
        { [field]: { $gt: max } },
        { $set: { [field]: max } },
      );

      // Порог ниже новой нижней границы поднимаем до неё, но только если
      // уровень вообще включён
      const below = await this.accountModel.updateMany(
        { [field]: { $gt: 0, $lt: min } },
        { $set: { [field]: min } },
      );

      adjusted += above.modifiedCount + below.modifiedCount;
    }

    if (adjusted > 0) {
      this.logger.log(`[jackpot-settings] подрезано порогов: ${adjusted}`);
    }

    return adjusted;
  }

  // Проверяем здесь, а не в pipe: глобальной валидации в проекте нет,
  // а рамки, в которых max меньше min, сломали бы шкалу делением на ноль
  private validate(level: Level, range: ThresholdRangeDto): ThresholdRange {
    if (!range) {
      throw new BadRequestException(`${level}: диапазон не передан`);
    }

    const min = this.number(level, 'min', range.min);
    const max = this.number(level, 'max', range.max);
    const step = this.number(level, 'step', range.step);

    if (min < 0) {
      throw new BadRequestException(`${level}: min не может быть отрицательным`);
    }
    if (max <= min) {
      throw new BadRequestException(`${level}: max должен быть больше min`);
    }
    if (step < 1) {
      throw new BadRequestException(`${level}: step должен быть не меньше 1`);
    }
    if (step > max - min) {
      throw new BadRequestException(
        `${level}: step больше самого диапазона (${max - min})`,
      );
    }

    return { min, max, step };
  }

  private number(level: Level, field: string, value: unknown): number {
    const parsed = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(parsed)) {
      throw new BadRequestException(`${level}.${field}: ожидается число`);
    }
    return Math.round(parsed);
  }
}
