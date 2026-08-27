import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { Casino, CasinoDocument, CasinoEvent } from './casino.schema';
import { CreateCasinoDto } from './dto/create-casino.dto';
import { UpdateCasinoDto } from './dto/update-casino.dto';
import { CasinoEventDto, UpdateCasinoEventDto } from './dto/casino-event.dto';
import { Author, AuthorshipService } from '../activity-log/authorship.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { ActivityAction, ActivityEntity } from '../activity-log/activity-log.schema';
import { CurrentUser } from '../auth/roles';
import { JackpotFeedEntry } from '../jackpot-state/jackpot-levels.util';

// Ровно то, что отдаёт сервер зала: массив пулов с собственными названиями.
// Раньше тут значилось { mini, middle, mega } — формы, которой в ответе нет
// и не было, из-за чего крон рассылки читал undefined
export interface JackpotFeed {
  jackpots: JackpotFeedEntry[];
}

export interface JackpotError {
  error: true;
  message: string;
  details: string;
}

export type JackpotResult = JackpotFeed | JackpotError;

// Входящее мероприятие в общем PUT /casino/:id — может нести _id уже
// существующего, тогда его авторство сохраняется
type IncomingEvent = {
  _id?: string | Types.ObjectId;
  name: Record<string, string> | string;
  description: Record<string, string> | string;
  start: Date | string;
  end: Date | string;
};

@Injectable()
export class CasinoService {
  constructor(
    @InjectModel(Casino.name) private casinoModel: Model<CasinoDocument>,
    private readonly configService: ConfigService,
    private readonly authorship: AuthorshipService,
    private readonly activityLog: ActivityLogService,
  ) {}

  /* async getCities(): Promise<Record<string, string>> {
    return this.casinoModel.distinct('city');
  } */

  async getCities(): Promise<Record<string, string>[]> {
    const casinos = await this.casinoModel.find().select('city').exec();

    const cities = casinos.map(c => c.city);

    // Убираем дубликаты по английскому названию (или любому другому ключу)
    const unique = new Map<string, Record<string, string>>();

    for (const city of cities) {
      const key = city.en || JSON.stringify(city);
      unique.set(key, city);
    }

    return Array.from(unique.values());
  }

  async findAll(): Promise<Casino[]> {
    return this.casinoModel.find().sort({ create_date: -1 }).exec();
  }

  async findOne(id: string): Promise<Casino> {
    const doc = await this.casinoModel.findById(id).exec();
    if (!doc) throw new NotFoundException(`Casino ${id} not found`);
    return doc;
  }

  async create(dto: CreateCasinoDto, user: CurrentUser): Promise<Casino> {
    const author = await this.authorship.resolve(user);

    const normalized = dto.events
      ? this.normalizeEvents(dto.events as IncomingEvent[], [], author)
      : null;

    const casino = await new this.casinoModel({
      ...dto,
      ...(normalized ? { events: normalized.events } : {}),
    }).save();

    for (const event of normalized?.created ?? []) {
      await this.logEvent(author, ActivityAction.CREATE, casino, event);
    }

    return casino;
  }

  async update(id: string, dto: UpdateCasinoDto, user: CurrentUser): Promise<Casino> {
    const author = await this.authorship.resolve(user);

    const existing = await this.casinoModel.findById(id).exec();
    if (!existing) throw new NotFoundException(`Casino ${id} not found`);

    // Мероприятия приходят массивом целиком: сохраняем _id и автора тех,
    // что уже были, новым проставляем текущего пользователя
    const normalized = dto.events
      ? this.normalizeEvents(dto.events as IncomingEvent[], existing.events ?? [], author)
      : null;

    const updated = await this.casinoModel.findByIdAndUpdate(
      id,
      { ...dto, ...(normalized ? { events: normalized.events } : {}) },
      { new: true },
    ).exec();
    if (!updated) throw new NotFoundException(`Casino ${id} not found`);

    for (const event of normalized?.created ?? []) {
      await this.logEvent(author, ActivityAction.CREATE, updated, event);
    }

    return updated;
  }

  // ---------- МЕРОПРИЯТИЯ ----------

  async findEvents(casinoId: string): Promise<CasinoEvent[]> {
    const casino = await this.casinoModel.findById(casinoId).select('events').lean();
    if (!casino) throw new NotFoundException(`Casino ${casinoId} not found`);
    return casino.events ?? [];
  }

  async addEvent(casinoId: string, dto: CasinoEventDto, user: CurrentUser): Promise<CasinoEvent> {
    const author = await this.authorship.resolve(user);

    const casino = await this.casinoModel.findById(casinoId).exec();
    if (!casino) throw new NotFoundException(`Casino ${casinoId} not found`);

    this.authorship.assertCanManageCasino(author, casino._id as Types.ObjectId);

    const event = this.normalizeEvent(dto, author);
    this.eventArray(casino).push(event);
    await casino.save();

    const created = casino.events[casino.events.length - 1];
    await this.logEvent(author, ActivityAction.CREATE, casino, created);

    return created;
  }

  async updateEvent(
    casinoId: string,
    eventId: string,
    dto: UpdateCasinoEventDto,
    user: CurrentUser,
  ): Promise<CasinoEvent> {
    const author = await this.authorship.resolve(user);

    const casino = await this.casinoModel.findById(casinoId).exec();
    if (!casino) throw new NotFoundException(`Casino ${casinoId} not found`);

    this.authorship.assertCanManageCasino(author, casino._id as Types.ObjectId);

    const event = this.eventArray(casino).id(eventId);
    if (!event) throw new NotFoundException(`Event ${eventId} not found`);

    // Крупье редактирует только свои мероприятия, админ — любые
    this.authorship.assertCanEdit(author, event.created_by);

    if (dto.name !== undefined) event.name = this.normalizeLocalizedField(dto.name);
    if (dto.description !== undefined) {
      event.description = this.normalizeLocalizedField(dto.description);
    }
    if (dto.start !== undefined) event.start = new Date(dto.start);
    if (dto.end !== undefined) event.end = this.endOfDay(dto.end);

    // active всегда пересчитывается сервером, клиент её не присылает
    event.active = event.start <= new Date();

    await casino.save();

    await this.logEvent(author, ActivityAction.UPDATE, casino, event);

    return event;
  }

  async deleteEvent(casinoId: string, eventId: string, user: CurrentUser): Promise<CasinoEvent> {
    const author = await this.authorship.resolve(user);

    const casino = await this.casinoModel.findById(casinoId).exec();
    if (!casino) throw new NotFoundException(`Casino ${casinoId} not found`);

    this.authorship.assertCanManageCasino(author, casino._id as Types.ObjectId);

    const event = this.eventArray(casino).id(eventId);
    if (!event) throw new NotFoundException(`Event ${eventId} not found`);

    this.authorship.assertCanEdit(author, event.created_by);

    const snapshot: CasinoEvent = event.toObject ? event.toObject() : event;

    this.eventArray(casino).pull({ _id: event._id });
    await casino.save();

    await this.logEvent(author, ActivityAction.DELETE, casino, snapshot);

    return snapshot;
  }

  // events объявлен обычным массивом ради типизации ответов,
  // в рантайме это DocumentArray с .id()/.pull()
  private eventArray(casino: CasinoDocument): Types.DocumentArray<any> {
    return casino.events as unknown as Types.DocumentArray<any>;
  }

  private async logEvent(
    author: Author,
    action: ActivityAction,
    casino: Casino & { _id?: unknown },
    event: CasinoEvent,
  ): Promise<void> {
    await this.activityLog.log(author, {
      action,
      entity: ActivityEntity.EVENT,
      entity_id: event._id ? event._id.toString() : null,
      title: event.name,
      casino_id: String(casino._id),
    });
  }

  // Событие действует весь день end целиком, поэтому время всегда
  // выравнивается на 23:59:59.999 по серверному времени, что бы ни прислал клиент.
  // active не редактируется клиентом — всегда пересчитывается сервером
  // из start (дальше её держит в актуальном состоянии крон в TasksService)
  private normalizeEvent(
    event: CasinoEventDto,
    author: Author,
    previous?: CasinoEvent,
  ): CasinoEvent {
    const start = new Date(event.start);

    return {
      ...(previous?._id ? { _id: previous._id } : {}),
      name: this.normalizeLocalizedField(event.name),
      description: this.normalizeLocalizedField(event.description),
      start,
      end: this.endOfDay(event.end),
      active: start <= new Date(),
      // Автора первой публикации не переписываем
      created_by: previous?.created_by ?? author.id,
      created_by_login: previous?.created_by_login ?? author.login,
    };
  }

  private normalizeEvents(
    events: IncomingEvent[],
    previous: CasinoEvent[],
    author: Author,
  ): { events: CasinoEvent[]; created: CasinoEvent[] } {
    const previousById = new Map(
      (previous ?? []).map(e => [e._id ? e._id.toString() : '', e]),
    );

    const created: CasinoEvent[] = [];

    const normalized = events.map(e => {
      const prev = e._id ? previousById.get(e._id.toString()) : undefined;
      const event = this.normalizeEvent(e as CasinoEventDto, author, prev);
      if (!prev) created.push(event);
      return event;
    });

    return { events: normalized, created };
  }

  private endOfDay(value: Date | string): Date {
    const end = new Date(value);
    end.setHours(23, 59, 59, 999);
    return end;
  }

  // Старые клиенты присылают name/description событий обычной строкой —
  // дублируем её во все локали, чтобы приложение всегда нашло свой язык
  private normalizeLocalizedField(value: Record<string, string> | string): Record<string, string> {
    if (typeof value !== 'string') return value ?? {};
    return { bg: value, el: value, en: value, ru: value, tr: value };
  }

  async delete(id: string): Promise<Casino> {
    const deleted = await this.casinoModel.findByIdAndDelete(id).exec();
    if (!deleted) throw new NotFoundException(`Casino ${id} not found`);
    return deleted;
  }

  async geocode(ids: string[]): Promise<{ updated: number; errors: string[] }> {
    const apiKey = this.configService.get<string>('GOOGLE_MAPS_API_KEY');
    if (!apiKey) throw new Error('GOOGLE_MAPS_API_KEY not configured');

    const casinos = ids.length > 0
      ? await this.casinoModel.find({ _id: { $in: ids } }).exec()
      : await this.casinoModel.find().exec();

    let updated = 0;
    const errors: string[] = [];

    for (const casino of casinos) {
      const addressStr =
        casino.address?.['en'] ??
        casino.address?.['bg'] ??
        Object.values(casino.address ?? {})[0];

      if (!addressStr) {
        errors.push(`${casino._id}: no address`);
        continue;
      }

      try {
        const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(addressStr)}&key=${apiKey}`;
        const res = await fetch(url);
        const data = await res.json();

        if (data.status !== 'OK' || !data.results?.[0]) {
          errors.push(`${casino._id}: ${data.status}`);
          continue;
        }

        const { lat, lng } = data.results[0].geometry.location;
        await this.casinoModel.findByIdAndUpdate(casino._id, { latitude: lat, longitude: lng });
        updated++;
      } catch (err) {
        errors.push(`${casino._id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return { updated, errors };
  }

  // Получить текущие значения джекпотов со всех внешних серверов казино
  async getJackpotValuesForCasino(casino: Casino): Promise<JackpotResult[]> {
    return Promise.all(
      (casino.jackpot_url ?? []).map(url => this.fetchJackpotValues(url)),
    );
  }

  private async fetchJackpotValues(url: string): Promise<JackpotResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`Jackpot server responded with ${response.status}`);
      }

      // Ответ уходит в приложение как есть — оно разбирает jackpots[] само.
      // Проверяем только, что это вообще фид: иначе и крон, и экран
      // молча показывали бы пустоту вместо «источник сломался»
      const payload = await response.json();
      if (!payload || !Array.isArray(payload.jackpots)) {
        throw new Error('Unexpected payload: no jackpots[]');
      }

      return payload as JackpotFeed;
    } catch (error) {
      clearTimeout(timeout);
      return {
        error: true,
        message: 'Failed to load jackpot data',
        details: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
