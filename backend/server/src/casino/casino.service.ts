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

  async getCities(): Promise<string[]> {
    return this.casinoModel.distinct('city');
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
}
