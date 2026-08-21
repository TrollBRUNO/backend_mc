import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import mongoose, { Model, Types } from 'mongoose';
import {
  Account,
  AccountDocument,
  JACKPOT_THRESHOLD_DEFAULTS,
  JACKPOT_THRESHOLD_LIMITS,
} from './account.schema';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import { AccountRole } from '../auth/roles';
import { Casino, CasinoDocument } from '../casino/casino.schema';
import { formatCardId, isValidCardId, normalizeCardId } from './card-id.util';
import { resolveJackpotAudience } from '../jackpot-audience/jackpot-audience.util';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AccountService {
  constructor(
    @InjectModel(Account.name) private accountModel: Model<AccountDocument>,
    @InjectModel(Casino.name) private casinoModel: Model<CasinoDocument>,
  ) {}

  async findAll(): Promise<Account[]> {
    return this.accountModel.find().sort({ create_date: -1 }).exec();
  }

  async findOne(id: string): Promise<Account> {
    const doc = await this.accountModel.findById(id).exec();
    if (!doc) throw new NotFoundException(`Account ${id} not found`);
    return doc;
  }  

  // Создание аккаунта админом из админки. Пароль здесь раньше уходил в базу
  // открытым текстом, а role бралась из тела запроса
  async create(dto: CreateAccountDto): Promise<Account> {
    const { role: _role, password, cards, ...rest } = dto;

    const account = new this.accountModel({
      ...rest,
      // Карты и здесь идут через buildCard: раньше они попадали в базу как
      // есть, без card_id_norm, и бонус по такой карте потом не находился
      cards: await Promise.all((cards ?? []).map(card => this.buildCard(card))),
      ...(password ? { password: await bcrypt.hash(password, 10) } : {}),
      role: AccountRole.USER,
    });

    return account.save();
  }

  // Поля, которые вообще можно менять через PUT /account/:id.
  // Роль, залы крупье, token_version, пароль и привязки соцсетей сюда не входят:
  // раньше тело запроса уходило в базу целиком и любой мог прислать
  // { "role": "admin" } и стать админом
  private static readonly UPDATABLE_FIELDS = [
    'login',
    'realname',
    'balance',
    'bonus_balance',
    'fake_balance',
    'image_url',
    'is_blocked',
    'block_reason',
    'locale',
  ] as const;

  async update(id: string, dto: UpdateAccountDto): Promise<Account> {
    const patch: Record<string, unknown> = {};

    for (const field of AccountService.UPDATABLE_FIELDS) {
      if (dto[field] !== undefined) patch[field] = dto[field];
    }

    const updated = await this.accountModel.findByIdAndUpdate(id, patch, { new: true }).exec();
    if (!updated) throw new NotFoundException(`Account ${id} not found`);
    return updated;
  }

  async delete(id: string): Promise<Account> {
    const deleted = await this.accountModel.findByIdAndDelete(id).exec();
    if (!deleted) throw new NotFoundException(`Account ${id} not found`);
    return deleted;
  }   

  async getProfile(accountId: string) {
    const account = await this.accountModel.findById(accountId);
    if (!account) throw new NotFoundException('Account not found');

    return {
      login: account.login,
      realname: account.realname,
      balance: account.balance,
      bonus_balance: account.bonus_balance,
      credit_balance: account.fake_balance,
      image_url: account.image_url,
      cards: account.cards,
    };
  }

  async register(dto: {
    login: string;
    password: string;
    realname: string;
    cards?: {
      card_id: string;
      casino_id: string;
      active: boolean;
    }[];
    notification_preference?: { cities?: string[]; brands?: string[] } | null;
    // role из тела запроса игнорируется, см. ниже
    role?: string;
    locale?: string;
  }) {
    // 1️⃣ username уникален
    const loginExists = await this.accountModel.findOne({
      login: dto.login,
    });

    if (loginExists) {
      throw new BadRequestException('USERNAME_TAKEN');
    }

    // 2️⃣ карта уникальна в своём зале
    const cards = await Promise.all(
      (dto.cards ?? []).map(card => this.buildCard(card)),
    );

    for (const card of cards) {
      await this.checkCardAvailability(card.card_id, String(card.casino_id));
    }

    const hash = await bcrypt.hash(dto.password, 10);

    const account = new this.accountModel({
      login: dto.login,
      password: hash,
      realname: dto.realname,
      cards,
      // Публичная регистрация всегда создаёт обычного пользователя.
      // Роль из тела запроса не берём: иначе кто угодно мог бы прислать
      // role: 'admin' или 'croupier' и выдать себе права.
      // Админа заводит владелец проекта прямо в базе, крупье — админ
      // через POST /croupiers.
      role: AccountRole.USER,
      locale: dto.locale ?? 'bg',
      // Шаг с городом и сетью при регистрации необязателен
      notification_preference: this.buildNotificationPreference(
        dto.notification_preference,
      ),
    });

    await account.save();

    return { success: true };
  }

  async generateBonusCode(accountId: string): Promise<string> {
    const account = await this.accountModel.findById(accountId);

    if (!account) {
      throw new NotFoundException('Account not found');
    }

    // генерируем 6-значный код (000000–999999)
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    account.bonus_code = code;

    // TTL: 5 минут
    account.bonus_code_expire = new Date(Date.now() + 5 * 60 * 1000);

    await account.save();

    return code;
  }

  async verifyBonusCode(
    accountId: string,
    card_id: string,
    code: string,
  ) {
    // 1. Ищем аккаунт
    const account = await this.accountModel.findById(accountId);

    if (!account) {
      throw new NotFoundException('Account not found');
    }

    // 2. Проверяем что карта принадлежит аккаунту.
    // Сравниваем канонические формы: в зале номер могут набрать
    // в другом регистре или с другим расположением дефиса
    const norm = normalizeCardId(card_id);
    const card = account.cards.find(
      c => c.card_id_norm === norm && c.active === true
    );

    if (!card) {
      throw new BadRequestException('This card is not linked to this account or not active');
    }

    // 3. Проверяем корректность кода
    if (!account.bonus_code || account.bonus_code !== code) {
      throw new BadRequestException('Invalid bonus code');
    }

    // 4. Проверяем срок годности
    if (!account.bonus_code_expire || account.bonus_code_expire < new Date()) {
      throw new BadRequestException('Bonus code expired');
    }

    // 5. Сбрасываем бонусный баланс полностью
    account.bonus_balance = 0 as any;

    // 6. Сбрасываем код (исправлено!)
    account.bonus_code = null;
    account.bonus_code_expire = null;

    await account.save();

    return {
      success: true,
      message: 'Bonus applied successfully',
      bonus_balance: account.bonus_balance,
    };
  }

  // Снимок города для card.city. Нужен только тем клиентам, что ещё не умеют
  // casino_id: у них город в карте — обычная строка. Берём болгарский, он же
  // дефолтная локаль. После .lean() поле приходит то объектом, то Map
  private cityLabel(city: unknown): string {
    const plain = this.toPlainRecord(city);
    return plain.bg ?? plain.en ?? Object.values(plain)[0] ?? '';
  }

  // Мультиязычные поля казино приходят из mongoose то объектом, то Map
  private toPlainRecord(value: unknown): Record<string, string> {
    if (!value) return {};
    return value instanceof Map
      ? (Object.fromEntries(value) as Record<string, string>)
      : (value as Record<string, string>);
  }

  // Единая точка, где номер карты приводится к каноническому виду и
  // привязывается к залу. Всё, что пишет карту в базу, обязано идти через
  // неё, иначе поиск по card_id_norm мимо такой карты промахнётся
  private async buildCard(dto: {
    card_id: string;
    casino_id: string;
    active?: boolean;
  }) {
    if (!isValidCardId(dto.card_id)) {
      throw new BadRequestException('INVALID_CARD_ID');
    }
    if (!Types.ObjectId.isValid(dto.casino_id)) {
      throw new BadRequestException('INVALID_CASINO_ID');
    }

    const casino = await this.casinoModel
      .findById(dto.casino_id)
      .select('city')
      .lean();
    if (!casino) throw new NotFoundException('Casino not found');

    return {
      card_id: formatCardId(dto.card_id),
      card_id_norm: normalizeCardId(dto.card_id),
      casino_id: new Types.ObjectId(dto.casino_id),
      city: this.cityLabel(casino.city),
      active: dto.active ?? true,
    };
  }

  async bindCard(
    accountId: string,
    dto: { card_id: string; casino_id: string },
  ) {
    const card = await this.buildCard(dto);

    await this.checkCardAvailability(card.card_id, dto.casino_id);

    const account = await this.accountModel.findById(accountId);
    if (!account) throw new NotFoundException('Account not found');

    account.cards.push(card);
    await account.save();

    return card;
  }

  async listCards(accountId: string) {
    const account = await this.accountModel.findById(accountId);
    if (!account) throw new NotFoundException('Account not found');

    return account.cards;
  }

  async removeCard(accountId: string, cardId: string) {
    const account = await this.accountModel.findById(accountId);
    if (!account) throw new NotFoundException('Account not found');

    const card = account.cards.find(
      c => c.card_id_norm === normalizeCardId(cardId),
    );
    if (!card) throw new NotFoundException('Card not found');

    card.active = false;

    await account.save();
    return card;
  }

  async checkCardAvailability(cardId: string, casinoId?: string): Promise<void> {
    // Занятость проверяем по канонической форме — иначе одну и ту же карту
    // можно было бы привязать второй раз, набрав её в другом написании.
    // И в пределах зала: нумерация у залов своя, PB-123456 в Пловдиве
    // и PB-123456 в Кирково — две разные карты двух разных людей
    const match: Record<string, unknown> = {
      card_id_norm: normalizeCardId(cardId),
      active: true,
    };

    // Клиент без casino_id (старая версия приложения) проверяется по всей
    // базе, как раньше: строже, чем нужно, но чужую карту не отдаст
    if (casinoId) {
      if (!Types.ObjectId.isValid(casinoId)) {
        throw new BadRequestException('INVALID_CASINO_ID');
      }
      match.casino_id = new Types.ObjectId(casinoId);
    }

    const exists = await this.accountModel.findOne({ cards: { $elemMatch: match } });

    if (exists) {
      throw new BadRequestException('CARD_ALREADY_USED');
    }
  }

  /* async canSpin(accountId: string): Promise<{ canSpin: boolean; nextSpin?: Date }> {
    const account = await this.accountModel.findById(accountId);
    if (!account) throw new NotFoundException('Account not found');

    const now = new Date();
    const lastSpin = account.last_spin_date;
    const bonus = Number(account.bonus_balance?.toString() ?? 0);

    // Если бонус не забрали > 24 часа — сгорает
    if (lastSpin && account.bonus_balance && bonus > 0) {
      const diff = now.getTime() - lastSpin.getTime();
      if (diff >= 24 * 60 * 60 * 1000) {
        account.bonus_balance = 0 as any;
        await account.save();
      }
    }

    // Можно ли крутить колесо?
    if (!lastSpin) return { canSpin: true };

    const diff = now.getTime() - lastSpin.getTime();
    if (diff >= 24 * 60 * 60 * 1000) {
      return { canSpin: true };
    } else {
      return { canSpin: false, nextSpin: new Date(lastSpin.getTime() + 24 * 60 * 60 * 1000) };
    }
  } */

  async canSpin(accountId: string) {
    const account = await this.accountModel.findById(accountId);
    if (!account) throw new NotFoundException();

    if (!account.last_spin_date) {
      return { canSpin: true }; // 👈 первый раз
    }

    const diff = Date.now() - account.last_spin_date.getTime();

    if (diff >= 24 * 60 * 60 * 1000) {
      return { canSpin: true };
    }

    return {
      canSpin: false,
      nextSpin: new Date(account.last_spin_date.getTime() + 24 * 60 * 60 * 1000),
    };
  }

  //Получение fake_balance (TakeCredit/CreditTake) раз в 24 часа
  /* async canTakeCredit(accountId: string): Promise<{ canTake: boolean; nextTake?: Date }> {
    const account = await this.accountModel.findById(accountId);
    if (!account) throw new NotFoundException('Account not found');

    const lastCredit = account.last_credit_take_date; // добавить в схему поле Date | null
    const now = new Date();

    if (!lastCredit) return { canTake: true };

    const diff = now.getTime() - lastCredit.getTime();
    if (diff >= 24 * 60 * 60 * 1000) {
      return { canTake: true };
    } else {
      return { canTake: false, nextTake: new Date(lastCredit.getTime() + 24 * 60 * 60 * 1000) };
    }
  } */

  async canTakeCredit(accountId: string) {
    const account = await this.accountModel.findById(accountId);
    if (!account) throw new NotFoundException();

    if (!account.last_credit_take_date) {
      return { canTake: true }; // 👈 ПЕРВЫЙ РАЗ
    }

    const diff = Date.now() - account.last_credit_take_date.getTime();

    if (diff >= 24 * 60 * 60 * 1000) {
      return { canTake: true };
    }

    return {
      canTake: false,
      nextTake: new Date(account.last_credit_take_date.getTime() + 24 * 60 * 60 * 1000),
    };
  }

  async takeCredit(accountId: string, amount = 1000) {
    const account = await this.accountModel.findById(accountId);
    if (!account) throw new NotFoundException('Account not found');

    const now = new Date();

    if (account.last_credit_take_date) {
      const diff = now.getTime() - account.last_credit_take_date.getTime();
      if (diff < 24 * 60 * 60 * 1000) {
        throw new BadRequestException('TOO_EARLY');
      }
    }

    const currentBonus = Number(account.fake_balance ?? 0);
    account.fake_balance = (currentBonus + amount) as any;
    account.last_credit_take_date = now;

    await account.save();

    //return account;
    return {
      fake_balance: account.fake_balance,
    }
  }

  async getProfileCards(accountId: string) {
    const account = await this.accountModel
      .findById(accountId)
      .select('cards')
      .lean();

    if (!account) {
      throw new NotFoundException('Account not found');
    }

    return {
      cards: account.cards.filter(card => card.active),
    };
  }

  async removeProfileCard(accountId: string, cardId: string) {
    const result = await this.accountModel.updateOne(
      {
        _id: new Types.ObjectId(accountId),
        'cards.card_id_norm': normalizeCardId(cardId),
      },
      { $set: { 'cards.$.active': false } }
    );

    if (result.modifiedCount === 0) {
      throw new NotFoundException('Active card not found');
    }

    return { success: true, card_id: cardId };
  }

  async getAllFullStats() {
    const accounts = await this.accountModel.find().lean();

    return accounts.map(acc => ({
      id: acc._id.toString(),
      login: acc.login,
      realname: acc.realname,

      balance: acc.balance?.toString() ?? "0",
      bonus_balance: acc.bonus_balance?.toString() ?? "0",
      fake_balance: acc.fake_balance?.toString() ?? "0",

      last_spin_date: acc.last_spin_date,
      last_credit_take_date: acc.last_credit_take_date,

      role: acc.role,
      google_id: acc.google_id,
      apple_id: acc.apple_id,

      cards: acc.cards,

      bonus_code: acc.bonus_code,
      bonus_code_expire: acc.bonus_code_expire,

      image_url: acc.image_url,

      is_blocked: acc.is_blocked,
      block_reason: acc.block_reason,

      token_version: acc.token_version,
    }));
  }

  async generateTemporaryPassword(accountId: string) {
    const account = await this.accountModel.findById(accountId);
    if (!account) throw new NotFoundException('Account not found');

      // Генерируем временный пароль
      const tempPassword = 'TEMP-' + Math.floor(100000 + Math.random() * 900000);

      // Хэшируем
      const hash = await bcrypt.hash(tempPassword, 10);

      // Обновляем пароль
      account.password = hash;
      account.token_version += 1; // инвалидируем старые токены
      await account.save();

      return {
        success: true,
        temp_password: tempPassword,
      };
    }

    async search(query: string) {
    const regex = new RegExp(query, 'i');

    // Номер карты ищем ещё и по канонической форме, чтобы админ находил её
    // в любом написании. Пустая каноническая форма (искали по имени, а не
    // по карте) дала бы регексп //, совпадающий со всеми — такой пункт не добавляем
    const normalized = normalizeCardId(query);

    return this.accountModel.find({
      $or: [
        { login: regex },
        { realname: regex },
        { 'cards.card_id': regex },
        ...(normalized ? [{ 'cards.card_id_norm': new RegExp(normalized, 'i') }] : []),
        { 'cards.city': regex },
      ]
    }).lean();
  }

  async sort(field: string, direction: 'asc' | 'desc') {
    const sortObj: any = {};
    sortObj[field] = direction === 'asc' ? 1 : -1;

    return this.accountModel.find().sort(sortObj).lean();
  }

  async updateCard(accountId: string, cardId: string, dto: { card_id?: string; casino_id?: string; active?: boolean }) {
    const account = await this.accountModel.findById(accountId);
    if (!account) throw new NotFoundException('Account not found');

    const norm = normalizeCardId(cardId);
    const card = account.cards.find(c => c.card_id_norm === norm);
    if (!card) throw new NotFoundException('Card not found');

    // Раньше админ мог записать номер как угодно, и карта переставала
    // находиться при выдаче бонуса — теперь она нормализуется и здесь
    if (dto.card_id) {
      if (!isValidCardId(dto.card_id)) {
        throw new BadRequestException('INVALID_CARD_ID');
      }
      card.card_id = formatCardId(dto.card_id);
      card.card_id_norm = normalizeCardId(dto.card_id);
    }

    // Зал меняется только целиком: город — снимок с него, руками не правится
    if (dto.casino_id) {
      const moved = await this.buildCard({
        card_id: dto.card_id ?? card.card_id,
        casino_id: dto.casino_id,
      });
      card.casino_id = moved.casino_id;
      card.city = moved.city;
    }

    if (dto.active !== undefined) card.active = dto.active;

    await account.save();
    return card;
  }

  async updateNotificationSettings(accountId: string, settings: any) {
    console.log('🔧 updateNotificationSettings:', settings);
    return this.accountModel.findByIdAndUpdate(accountId, {
      notification_settings: this.sanitizeNotificationSettings(settings),
    }, { new: true });
  }

  // Пороги приходят с ползунков приложения, но по ним крон решает,
  // слать ли пуш — поэтому границы проверяем здесь, а не доверяем клиенту.
  // Мусор и отсутствующие поля откатываются к дефолту
  private sanitizeNotificationSettings(settings: any) {
    const incoming = settings?.jackpot_thresholds ?? {};

    const clamp = (level: keyof typeof JACKPOT_THRESHOLD_LIMITS) => {
      const { min, max } = JACKPOT_THRESHOLD_LIMITS[level];
      const value = Number(incoming[level]);
      if (!Number.isFinite(value)) return JACKPOT_THRESHOLD_DEFAULTS[level];
      return Math.min(Math.max(Math.round(value), min), max);
    };

    return {
      ...settings,
      jackpot_thresholds: {
        mini: clamp('mini'),
        middle: clamp('middle'),
        mega: clamp('mega'),
      },
    };
  }

  async getNotificationSettings(accountId: string) {
    const acc = await this.accountModel.findById(accountId).lean();

    if (!acc) throw new NotFoundException('Account not found');

    return acc.notification_settings;
  }

  // Списки приходят с клиента: подрезаем, выбрасываем пустые строки и дубли.
  // Если обе части пусты, предпочтения нет — пишем null, чтобы крон
  // перешёл дальше по цепочке, к геолокации
  private buildNotificationPreference(
    pref?: { cities?: string[]; brands?: string[] } | null,
  ): { cities: string[]; brands: string[] } | null {
    const clean = (list?: string[]): string[] => {
      if (!Array.isArray(list)) return [];
      const trimmed = list
        .filter(item => typeof item === 'string')
        .map(item => item.trim())
        .filter(Boolean);
      return [...new Set(trimmed)];
    };

    const cities = clean(pref?.cities);
    const brands = clean(pref?.brands);

    if (!cities.length && !brands.length) return null;

    return { cities, brands };
  }

  // Тот же выбор, но уже после регистрации — из настроек уведомлений.
  // Пустой запрос очищает предпочтение и возвращает к геолокации
  async updateNotificationPreference(
    accountId: string,
    pref?: { cities?: string[]; brands?: string[] } | null,
  ) {
    const value = this.buildNotificationPreference(pref);

    await this.accountModel.updateOne(
      { _id: accountId },
      { $set: { notification_preference: value } },
    );

    return { success: true, notification_preference: value };
  }

  // Полная картина для экрана настроек: каждый зал с признаком включённости
  // и причиной. Считается тем же кодом, что и рассылка, — иначе список
  // в настройках со временем разошёлся бы с тем, что реально приходит
  async getCasinoNotifications(accountId: string) {
    const account = await this.accountModel.findById(accountId).lean();
    if (!account) throw new NotFoundException('Account not found');

    const casinos = await this.casinoModel
      .find()
      .select('name city address image_url latitude longitude')
      .lean();

    const audience = resolveJackpotAudience(
      account as any,
      casinos.map(c => ({
        casinoId: String(c._id),
        name: this.toPlainRecord(c.name),
        city: this.toPlainRecord(c.city),
        latitude: c.latitude,
        longitude: c.longitude,
      })),
    );

    const byId = new Map(audience.map(entry => [entry.casinoId, entry]));

    return casinos.map(casino => {
      const entry = byId.get(String(casino._id));
      return {
        casino_id: String(casino._id),
        name: this.toPlainRecord(casino.name),
        city: this.toPlainRecord(casino.city),
        address: this.toPlainRecord(casino.address),
        image_url: casino.image_url,
        enabled: entry?.enabled ?? true,
        source: entry?.source ?? 'all',
      };
    });
  }

  // Ручной переключатель одного зала. enabled: null снимает ручную отметку
  // и возвращает зал под управление автоматики
  async setCasinoNotification(
    accountId: string,
    casinoId: string,
    enabled: boolean | null,
  ) {
    if (!Types.ObjectId.isValid(casinoId)) {
      throw new BadRequestException('INVALID_CASINO_ID');
    }

    const exists = await this.casinoModel.exists({ _id: casinoId });
    if (!exists) throw new NotFoundException('Casino not found');

    const update = enabled === null
      ? { $unset: { [`casino_notification_overrides.${casinoId}`]: '' } }
      : { $set: { [`casino_notification_overrides.${casinoId}`]: enabled } };

    await this.accountModel.updateOne({ _id: accountId }, update);

    return { success: true, casino_id: casinoId, enabled };
  }

  async getNotificationPreference(accountId: string) {
    const account = await this.accountModel
      .findById(accountId)
      .select('notification_preference')
      .lean();

    if (!account) throw new NotFoundException('Account not found');

    return account.notification_preference ?? null;
  }

  // Координаты приходят с клиента, поэтому проверяем диапазон: в базу
  // не должен попасть мусор, по которому потом считается расстояние
  async updateLocation(accountId: string, lat: number, lng: number) {
    if (
      typeof lat !== 'number' || typeof lng !== 'number' ||
      !Number.isFinite(lat) || !Number.isFinite(lng) ||
      Math.abs(lat) > 90 || Math.abs(lng) > 180
    ) {
      throw new BadRequestException('INVALID_LOCATION');
    }

    await this.accountModel.updateOne(
      { _id: accountId },
      { $set: { last_location: { lat, lng, updated_at: new Date() } } },
    );

    return { success: true };
  }

  async updateFcmToken(id: string, token: string) {
    return this.accountModel.findByIdAndUpdate(id, { fcm_token: token });
  }
}
