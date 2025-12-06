import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Gallery, GalleryDocument } from './gallery.schema';
import { CreateGalleryDto } from './dto/create-gallery.dto';
import { UpdateGalleryDto } from './dto/update-gallery.dto';

@Injectable()
export class GalleryService {
  constructor(
    @InjectModel(Gallery.name) private galleryModel: Model<GalleryDocument>,
  ) {}

  async findAll(): Promise<Gallery[]> {
    return this.galleryModel.find().sort({ create_date: -1 }).exec();
  }

  async findOne(id: string): Promise<Gallery> {
    const doc = await this.galleryModel.findById(id).exec();
    if (!doc) throw new NotFoundException(`Gallery ${id} not found`);
    return doc;
  }  

  async create(dto: CreateGalleryDto): Promise<Gallery> {
    const gallery = new this.galleryModel(dto);
    return gallery.save();
  } 

  async update(id: string, dto: UpdateGalleryDto): Promise<Gallery> {
    const updated = await this.galleryModel.findByIdAndUpdate(id, dto, { new: true }).exec();
    if (!updated) throw new NotFoundException(`Gallery ${id} not found`);
    return updated;
  }   

  async delete(id: string): Promise<Gallery> {
    const deleted = await this.galleryModel.findByIdAndDelete(id).exec();
    if (!deleted) throw new NotFoundException(`Gallery ${id} not found`);
    return deleted;
  }   
}
