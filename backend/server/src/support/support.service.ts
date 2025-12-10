import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Support, SupportDocument } from './support.schema';
import { CreateSupportDto } from './dto/create-support.dto';
import { UpdateSupportDto } from './dto/update-support.dto';

@Injectable()
export class SupportService {
  constructor(
    @InjectModel(Support.name) private supportModel: Model<SupportDocument>,
  ) {}

  async findAll(): Promise<Support[]> {
    return this.supportModel.find().sort({ create_date: -1 }).exec();
  }

  async findOne(id: string): Promise<Support> {
    const doc = await this.supportModel.findById(id).exec();
    if (!doc) throw new NotFoundException(`Support ${id} not found`);
    return doc;
  }  

  async create(dto: CreateSupportDto): Promise<Support> {
    const support = new this.supportModel(dto);
    return support.save();
  } 

  async update(id: string, dto: UpdateSupportDto): Promise<Support> {
    const updated = await this.supportModel.findByIdAndUpdate(id, dto, { new: true }).exec();
    if (!updated) throw new NotFoundException(`Support ${id} not found`);
    return updated;
  }   

  async delete(id: string): Promise<Support> {
    const deleted = await this.supportModel.findByIdAndDelete(id).exec();
    if (!deleted) throw new NotFoundException(`News ${id} not found`);
    return deleted;
  }   
}
