import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';

import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { GalleryService } from './gallery.service';
import * as path from 'path';
import { v4 as uuid } from 'uuid';

@Controller('gallery')
export class GalleryController {
  constructor(private readonly galleryService: GalleryService) {}

  // ---------- GET ALL ----------
  @Get()
  findAll() {
    return this.galleryService.findAll();
  }

  // ---------- GET ONE ----------
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.galleryService.findOne(id);
  }

  // ---------- CREATE (multipart/form-data для файла) ----------
  @Post()
  @UseInterceptors(
    FileInterceptor('image', {
      storage: diskStorage({
        destination: './uploads',
        filename: (req, file, cb) => {
          const ext = path.extname(file.originalname);
          cb(null, uuid() + ext);
        },
      }),
    }),
  )
  async create(@UploadedFile() file: any, @Body() body: any) {
    const imageUrl = file
      ? `/uploads/${file.filename}`
      : body.image_url
      ? `/uploads/${body.image_url}`
      : `/uploads/logo_magic_city5.png`; // дефолт

    return this.galleryService.create({
      description: body.description,
      image_url: imageUrl,
    });
  }

  // ---------- CREATE через JSON (уже загруженные файлы) ----------
  @Post('json')
  async createJson(@Body() body: any) {
    const imageUrl = body.image_url ? `/uploads/${body.image_url}` : `/uploads/logo_magic_city5.png`;
    return this.galleryService.create({ ...body, image_url: imageUrl });
  }

  // ---------- UPDATE ----------
  @Put(':id')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: diskStorage({
        destination: './uploads',
        filename: (req, file, cb) => {
          const ext = path.extname(file.originalname);
          cb(null, uuid() + ext);
        },
      }),
    }),
  )
  async update(
    @Param('id') id: string,
    @UploadedFile() file: any,
    @Body() body: any,
  ) {
    const imageUrl = file
      ? `/uploads/${file.filename}`
      : body.image_url
      ? `/uploads/${body.image_url}`
      : undefined;

    return this.galleryService.update(id, {
      ...body,
      ...(imageUrl ? { image_url: imageUrl } : {}),
    });
  }

  // ---------- DELETE ----------
  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.galleryService.delete(id);
  }
}
