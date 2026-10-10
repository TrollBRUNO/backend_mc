import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Locale } from '../push/push-locales';
import { AccountRole } from '../auth/roles';

export type AccountDocument = Account & Document;

// Значения порогов у нового аккаунта. Границы, в которых их вообще можно
// выставить, лежат не здесь: их задаёт админ (JackpotSettingsService),
// потому что пулы у залов меняются вместе с самими залами
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

  // bcrypt-хеш. У тех, кто пришёл через Google, Apple или телефон, его нет,
  // пока человек сам не задаст пароль в настройках
  @Prop({ type: String, default: null })
  password: string | null;

  // Новые аккаунты имени не спрашивают и пишут сюда пустую строку:
  // список аккаунтов в админке ждёт здесь строку
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

  // Способы входа помимо пароля. Уникальность держат частичные индексы
  // внизу файла. Id приходят только из проверенного токена Firebase
  @Prop({ type: String, default: null })
  google_id: string | null;

  @Prop({ type: String, default: null })
  google_email: string | null;

  @Prop({ type: String, default: null })
  apple_id: string | null;

  // Может быть адресом-пересыльщиком Apple (…@privaterelay.appleid.com),
  // если человек скрыл настоящую почту
  @Prop({ type: String, default: null })
  apple_email: string | null;

  // Подтверждённый по SMS болгарский номер, +3598XXXXXXXX
  @Prop({ type: String, default: null })
  phone: string | null;

  // Как аккаунт заведён: password, google, apple, phone.
  // null — старые аккаунты, заведённые до появления поля
  @Prop({ type: String, default: null })
  registration_method: string | null;

  // Без default: иначе mongoose подставил бы «сейчас» старому аккаунту
  // при первом же save. У старых дата регистрации берётся из _id
  @Prop({ type: Date })
  created_at?: Date;

  // Последняя выдача токенов: вход или запуск приложения
  @Prop({ type: Date, default: null })
  last_login_at: Date | null;

  // Удалённый аккаунт остаётся в базе для истории, но логин, способы входа
  // и карты освобождаются — под ними может зарегистрироваться кто угодно.
  // Что было до удаления, лежит в deleted_snapshot для админки
  @Prop({ type: Date, default: null })
  deleted_at: Date | null;

  @Prop({ type: Object, default: null })
  deleted_snapshot: Record<string, any> | null;

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

// Один Google, Apple или номер — один аккаунт. Индекс частичный: у почти
// всех аккаунтов поле null, а обычный unique (и даже sparse — явный null
// он тоже индексирует) счёл бы их дублями друг друга.
// На проде старые sparse-индексы google_id_1 и apple_id_1 убирает миграция
// migrations/2026-10-03-social-auth.mongosh.js
for (const field of ['google_id', 'apple_id', 'phone']) {
  AccountSchema.index(
    { [field]: 1 },
    {
      name: `${field}_unique`,
      unique: true,
      partialFilterExpression: { [field]: { $type: 'string' } },
    },
  );
}