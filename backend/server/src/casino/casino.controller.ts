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
  UseGuards,
} from '@nestjs/common';

import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { CasinoService } from './casino.service';
import * as path from 'path';
import { v4 as uuid } from 'uuid';
import { AdminGuard } from 'src/auth/guards/admin.guard';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

@Controller('casino')
export class CasinoController {
  constructor(private readonly casinoService: CasinoService) {}

  // ---------- GET ALL ----------
  @Get()
  findAll() {
    return this.casinoService.findAll();
  }

  // ---------- GET CITIES ----------
  @Get('cities')
  async getCities() {
    return this.casinoService.getCities();
  }

  // ---------- GET ONE ----------
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.casinoService.findOne(id);
  }

  // ---------- CREATE (multipart/form-data для файла) ----------
  @UseGuards(JwtAuthGuard, AdminGuard)
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

    return this.casinoService.create({
      city: body.city,
      address: body.address,
      mystery_progressive: body.mystery_progressive,
      jackpot_url: body.jackpot_url,
      image_url: imageUrl,
      uu_id_list: body.uu_id_list,
    });
  }

    // ---------- Брать джекпот по URL ----------
  @Get(':id/jackpots')
  async getJackpots(@Param('id') id: string) {
  const casino = await this.casinoService.findOne(id);
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

    return await response.json();
  } catch (error) {
      return {
        error: true,
        message: 'Failed to load jackpot data',
        details: error.message,
      };
    }
  }

  // ---------- CREATE через JSON (уже загруженные файлы) ----------
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post('json')
  async createJson(@Body() body: any) {
    const imageUrl = body.image_url ? `/uploads/${body.image_url}` : `/uploads/logo_magic_city5.png`;
    return this.casinoService.create({ ...body, image_url: imageUrl });
  }

  // ---------- UPDATE ----------
  @UseGuards(JwtAuthGuard, AdminGuard)
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

    return this.casinoService.update(id, {
      ...body,
      ...(imageUrl ? { image_url: imageUrl } : {}),
    });
  }

  // ---------- DELETE ----------
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.casinoService.delete(id);
  }
}
