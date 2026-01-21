import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Casino, CasinoDocument } from './casino.schema';
import { CreateCasinoDto } from './dto/create-casino.dto';
import { UpdateCasinoDto } from './dto/update-casino.dto';

@Injectable()
export class CasinoService {
  constructor(
    @InjectModel(Casino.name) private casinoModel: Model<CasinoDocument>,
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
    const casino = new this.casinoModel(dto);
    return casino.save();
  } 

  async update(id: string, dto: UpdateCasinoDto): Promise<Casino> {
    const updated = await this.casinoModel.findByIdAndUpdate(id, dto, { new: true }).exec();
    if (!updated) throw new NotFoundException(`Casino ${id} not found`);
    return updated;
  }   

  async delete(id: string): Promise<Casino> {
    const deleted = await this.casinoModel.findByIdAndDelete(id).exec();
    if (!deleted) throw new NotFoundException(`Casino ${id} not found`);
    return deleted;
  }   

  // Получить текущие значения джекпотов с внешнего сервера
  async getJackpotValues(id: string) {
    const casino = await this.findOne(id);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(casino.jackpot_url, {
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`Jackpot server responded with ${response.status}`);
      }

      return await response.json(); // { mini: 123, middle: 456, mega: 789 }
    } catch (error) {
      return {
        error: true,
        message: 'Failed to load jackpot data',
        details: error.message,
      };
    }
  }
}
