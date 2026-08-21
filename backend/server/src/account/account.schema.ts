import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Locale } from '../push/push-locales';
import { AccountRole } from '../auth/roles';

export type AccountDocument = Account & Document;

// Пороги джекпота — границы ползунков в приложении и значения по умолчанию.
// Держим их на бэке: именно по порогу решается, слать ли пуш
// (TasksService.jackpotThresholdCheck), а клиент присылает что угодно
export const JACKPOT_THRESHOLD_LIMITS = {
  mini:   { min: 0, max: 1000 },
  middle: { min: 0, max: 5000 },
  mega:   { min: 0, max: 10000 },
} as const;

export const JACKPOT_THRESHOLD_DEFAULTS = {
  mini: 100,
  middle: 500,
  mega: 2000,
} as const;

@Schema()
export class Account {
  @Prop({ type: Types.Decimal128, default: 0 })
  balance: Types.Decimal128;

  @Prop({ type: Types.Decimal128, default: 0 })
  bonus_balance: Types.Decimal128;

  @Prop({ type: Types.Decimal128, default: 0 })
  fake_balance: Types.Decimal128;

  @Prop({ unique: true, index: true })
  login: string;

  @Prop()
  password: string;

  @Prop()
  realname: string;

  @Prop({ type: String, default: AccountRole.USER, index: true })
  role: string;

  // Залы, к которым подключён крупье (role === 'croupier').
  // У обычных пользователей и админов пустой — админу доступны все казино.
  @Prop({ type: [{ type: Types.ObjectId, ref: 'Casino' }], default: [] })
  casino_ids: Types.ObjectId[];

  // Денормализованная дата последнего действия в админке (создание/правка/удаление
  // новости, выигрыша, мероприятия). Пишется вместе с записью в activity_logs,
  // нужна для быстрой сортировки списка крупье по активности.
  @Prop({ type: Date, default: null })
  last_activity_at: Date | null;

  @Prop({ type: String, default: null, sparse: true})
  google_id: string | null;

  @Prop({ type: String, default: null, sparse: true})
  apple_id: string | null;

  @Prop({ type: String, default: null })
  fcm_token: string;

  @Prop({
    type: String,
    enum: Object.values(Locale),
    default: Locale.BG,
  })
  locale: Locale;

  // card_id хранится в том виде, в каком показывается человеку (GOTSE-123456),
  // а весь поиск идёт по card_id_norm — канонической форме из card-id.util.ts
  @Prop({
    type: [
      {
        card_id: String,
        card_id_norm: { type: String, index: true },
        // Зал, выдавший карту. Номера уникальны в пределах зала, а не
        // глобально: PB-123456 в Пловдиве и PB-123456 в Кирково — разные карты
        casino_id: { type: Types.ObjectId, ref: 'Casino', default: null, index: true },
        // Снимок названия города на момент привязки: нужен старым клиентам
        // и админскому поиску. Актуальное название берётся по casino_id
        city: String,
        active: Boolean
      }
    ],
    default: []
  })
  cards: {
    card_id: string;
    card_id_norm: string;
    casino_id: Types.ObjectId | null;
    city: string;
    active: boolean;
  }[];

  @Prop({
    type: {
      wheel_ready: { type: Boolean, default: true },
      bonus_reminder: { type: Boolean, default: true },
      news_post: { type: Boolean, default: true },
      jackpot_win_post: { type: Boolean, default: true },
      jackpot_enabled: { type: Boolean, default: true },
      jackpot_thresholds: {
        mini: { type: Number, default: JACKPOT_THRESHOLD_DEFAULTS.mini },
        middle: { type: Number, default: JACKPOT_THRESHOLD_DEFAULTS.middle },
        mega: { type: Number, default: JACKPOT_THRESHOLD_DEFAULTS.mega },
      },
    },
    default: {
      wheel_ready: true,
      bonus_reminder: true,
      news_post: true,
      jackpot_win_post: true,
      jackpot_enabled: true,
      jackpot_thresholds: { ...JACKPOT_THRESHOLD_DEFAULTS },
    },
  })
  notification_settings: {
    wheel_ready: boolean;
    bonus_reminder: boolean;
    news_post: boolean;
    jackpot_win_post: boolean;
    jackpot_enabled: boolean;
    jackpot_thresholds: {
      mini: number;
      middle: number;
      mega: number;
    };
  };

  // Города и сети, выбранные при регистрации. Храним правилом, а не списком
  // залов: если в выбранном городе откроется ещё один зал выбранной сети,
  // он попадёт в уведомления сам, без правки аккаунтов.
  //
  // Оба списка независимы и каждый может быть пустым:
  //   города есть, сетей нет — все залы этих городов
  //   сети есть, городов нет — все залы этих сетей в любом городе
  //   есть и то и другое — залы на пересечении
  //   пусто и там и там — предпочтения нет, работает геолокация
  //
  // cities — канонические ключи городов (city.en), brands — названия сетей (name.en)
  @Prop({
    type: {
      cities: { type: [String], default: [] },
      brands: { type: [String], default: [] },
    },
    default: null,
  })
  notification_preference: {
    cities: string[];
    brands: string[];
  } | null;

  // Ручные переключатели залов поверх автоматического подбора: casino_id -> вкл/выкл.
  // Зал, выключенный руками, остаётся выключенным навсегда — даже если потом
  // привяжут его карту. Иначе выключатель не выключал бы.
  // Зала здесь нет — значит человек его не трогал и решает автоматика
  @Prop({ type: Map, of: Boolean, default: {} })
  casino_notification_overrides: Map<string, boolean>;

  // Последняя известная позиция пользователя. Пишется приложением на старте,
  // только если разрешение на геолокацию уже выдано — нового запроса прав
  // ради этого не показываем. Нужна, чтобы подобрать ближайшие залы тем,
  // у кого нет привязанной карты
  @Prop({
    type: {
      lat: { type: Number },
      lng: { type: Number },
      updated_at: { type: Date },
    },
    default: null,
  })
  last_location: {
    lat: number;
    lng: number;
    updated_at: Date;
  } | null;

  @Prop({ type: String, default: null })
  bonus_code: string | null;

  @Prop({ type: Date, default: null })
  bonus_code_expire: Date | null;

  @Prop()
  last_spin_date: Date;

  @Prop({ type: Date, default: null })
  last_credit_take_date: Date | null; 

  @Prop({ default: "profile4.png" })
  image_url: string;

  @Prop({ default: false })
  is_blocked: boolean;

  @Prop({ default: '' })
  block_reason: string;

  // Для реализации механизма инвалидирования JWT токенов при смене пароля и т.п.
  @Prop({ default: 0 })
  token_version: number;

  @Prop({ type: Date, default: null }) last_wheel_notify: Date | null;

  @Prop({ type: Date, default: null }) bonus_notified_12h: Date | null;
  @Prop({ type: Date, default: null }) bonus_notified_1h: Date | null;

  @Prop({ type: Date, default: null }) last_jackpot_notify: Date | null;

  @Prop({ type: Date, default: null }) last_new_notify: Date | null; 
  
  @Prop({ type: Date, default: null }) last_gallery_notify: Date | null;
}

export const AccountSchema = SchemaFactory.createForClass(Account);