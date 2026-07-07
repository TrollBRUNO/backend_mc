import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { Casino, CasinoDocument } from './casino.schema';
import { CreateCasinoDto } from './dto/create-casino.dto';
import { UpdateCasinoDto } from './dto/update-casino.dto';

export interface JackpotValues {
  mini: number;
  middle: number;
  mega: number;
}

export interface JackpotError {
  error: true;
  message: string;
  details: string;
}

export type JackpotResult = JackpotValues | JackpotError;

@Injectable()
export class CasinoService {
  constructor(
    @InjectModel(Casino.name) private casinoModel: Model<CasinoDocument>,
    private readonly configService: ConfigService,
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

  async create(dto: CreateCasinoDto): Promise<Casino> {
    const casino = new this.casinoModel({
      ...dto,
      ...(dto.events ? { events: this.withEndOfDay(dto.events) } : {}),
    });
    return casino.save();
  }

  async update(id: string, dto: UpdateCasinoDto): Promise<Casino> {
    const updated = await this.casinoModel.findByIdAndUpdate(
      id,
      { ...dto, ...(dto.events ? { events: this.withEndOfDay(dto.events) } : {}) },
      { new: true },
    ).exec();
    if (!updated) throw new NotFoundException(`Casino ${id} not found`);
    return updated;
  }

  // Событие действует весь день end целиком, поэтому время всегда
  // выравнивается на 23:59:59.999 по серверному времени, что бы ни прислал клиент
  private withEndOfDay(
    events: { name: string; start: Date; end: Date }[],
  ): { name: string; start: Date; end: Date }[] {
    return events.map(e => {
      const end = new Date(e.end);
      end.setHours(23, 59, 59, 999);
      return { ...e, end };
    });
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

      return await response.json(); // { mini, middle, mega }
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
