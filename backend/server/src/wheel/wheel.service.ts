import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Wheel, WheelDocument } from './wheel.schema';
import { CreateWheelDto } from './dto/create-wheel.dto';
import { UpdateWheelDto } from './dto/update-wheel.dto';

@Injectable()
export class WheelService {
  constructor(
    @InjectModel(Wheel.name) private wheelModel: Model<WheelDocument>,
  ) {}

  async findAll(): Promise<Wheel[]> {
    return this.wheelModel.find().exec();
  }

  async findOne(id: string): Promise<Wheel> {
    const doc = await this.wheelModel.findById(id).exec();
    if (!doc) throw new NotFoundException(`News ${id} not found`);
    return doc;
  }  

  async create(dto: CreateWheelDto): Promise<Wheel> {
    const news = new this.wheelModel(dto);
    return news.save();
  } 

  async update(id: string, dto: UpdateWheelDto): Promise<Wheel> {
    const updated = await this.wheelModel.findByIdAndUpdate(id, dto, { new: true }).exec();
    if (!updated) throw new NotFoundException(`News ${id} not found`);
    return updated;
  }   

  async delete(id: string): Promise<Wheel> {
    const deleted = await this.wheelModel.findByIdAndDelete(id).exec();
    if (!deleted) throw new NotFoundException(`News ${id} not found`);
    return deleted;
  }   

  async spin() {
    const items = await this.wheelModel.find().exec();

    if (!items.length) {
      throw new NotFoundException('Wheel is empty');
    }

    const randomIndex = Math.floor(Math.random() * items.length);
    const selected = items[randomIndex];

    return {
      index: randomIndex,
      value: selected.value,
      id: selected._id,
    };
  }
}
