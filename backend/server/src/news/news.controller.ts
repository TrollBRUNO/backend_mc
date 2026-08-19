import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseInterceptors,
  UploadedFile,
  UseGuards,
} from '@nestjs/common';

import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { NewsService } from './news.service';
import * as path from 'path';
import { v4 as uuid } from 'uuid';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AccountRole } from '../auth/roles';

// Новости ведут админ и крупье. Крупье правит и удаляет только свои —
// это проверяет NewsService через AuthorshipService.
@Controller('news')
export class NewsController {
  constructor(private readonly newsService: NewsService) {}

  // ---------- GET ALL ----------
  // Приложение зовёт без параметров, админка может фильтровать
  // по казино (?casino_id=) и по автору (?created_by=)
  @Get()
  findAll(
    @Query('casino_id') casinoId?: string,
    @Query('created_by') createdBy?: string,
  ) {
    return this.newsService.findAll({ casino_id: casinoId, created_by: createdBy });
  }

  // ---------- GET ONE ----------
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AccountRole.ADMIN, AccountRole.CROUPIER)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.newsService.findOne(id);
  }

  // ---------- UPLOAD IMAGE ----------
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AccountRole.ADMIN, AccountRole.CROUPIER)
  @Post('upload')
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
  uploadImage(@UploadedFile() file: any) {
    const imageUrl = `/uploads/${file.filename}`;
    return { image_url: imageUrl };
  }

  // ---------- CREATE (multipart/form-data для файла) ----------
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AccountRole.ADMIN, AccountRole.CROUPIER)
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
  async create(@Req() req, @UploadedFile() file: any, @Body() body: any) {
    const imageUrl = file
      ? `/uploads/${file.filename}`
      : body.image_url
      ? `/uploads/${body.image_url}`
      : `/uploads/logo_magic_city5.png`; // дефолт

    return this.newsService.create(
      {
        title: body.title,
        description: body.description,
        image_url: imageUrl,
        casino_id: body.casino_id,
      },
      req.user,
    );
  }

  // ---------- CREATE через JSON (уже загруженные файлы) ----------
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AccountRole.ADMIN, AccountRole.CROUPIER)
  @Post('json')
  async createJson(@Req() req, @Body() body: any) {
    const imageUrl = body.image_url ? `/uploads/${body.image_url}` : `/uploads/logo_magic_city5.png`;
    return this.newsService.create({ ...body, image_url: imageUrl }, req.user);
  }

  // ---------- UPDATE ----------
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AccountRole.ADMIN, AccountRole.CROUPIER)
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
    @Req() req,
    @Param('id') id: string,
    @UploadedFile() file: any,
    @Body() body: any,
  ) {
    const imageUrl = file
      ? `/uploads/${file.filename}`
      : body.image_url
      ? `/uploads/${body.image_url}`
      : undefined;

    return this.newsService.update(
      id,
      {
        ...body,
        ...(imageUrl ? { image_url: imageUrl } : {}),
      },
      req.user,
    );
  }

  // ---------- DELETE ----------
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AccountRole.ADMIN, AccountRole.CROUPIER)
  @Delete(':id')
  delete(@Req() req, @Param('id') id: string) {
    return this.newsService.delete(id, req.user);
  }
}
