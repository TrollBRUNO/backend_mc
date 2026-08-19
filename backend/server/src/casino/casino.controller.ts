import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Req,
  UseInterceptors,
  UploadedFile,
  UseGuards,
} from '@nestjs/common';

import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { CasinoService } from './casino.service';
import * as path from 'path';
import { v4 as uuid } from 'uuid';
import { AdminGuard } from '../auth/guards/admin.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AccountRole } from '../auth/roles';
import { CasinoEventDto, UpdateCasinoEventDto } from './dto/casino-event.dto';

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
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AccountRole.ADMIN, AccountRole.CROUPIER)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.casinoService.findOne(id);
  }

  // ---------- UPLOAD IMAGE ----------
  @UseGuards(JwtAuthGuard, AdminGuard)
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
  async create(@Req() req, @UploadedFile() file: any, @Body() body: any) {
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
      name: body.name,
      photos: body.photos,
      latitude: body.latitude != null ? parseFloat(body.latitude) : null,
      longitude: body.longitude != null ? parseFloat(body.longitude) : null,
      events: body.events,
    }, req.user);
  }

    // ---------- Брать джекпоты по списку URL ----------
  @Get(':id/jackpots')
  async getJackpots(@Param('id') id: string) {
    const casino = await this.casinoService.findOne(id);
    return this.casinoService.getJackpotValuesForCasino(casino);
  }

  // ---------- CREATE через JSON (уже загруженные файлы) ----------
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post('json')
  async createJson(@Req() req, @Body() body: any) {
    const imageUrl = body.image_url ? `/uploads/${body.image_url}` : `/uploads/logo_magic_city5.png`;
    return this.casinoService.create({ ...body, image_url: imageUrl }, req.user);
  }

  // ---------- МЕРОПРИЯТИЯ ЗАЛА ----------
  // Точечные ручки, чтобы крупье правил только события своего зала
  // и не трогал остальные поля казино (адрес, джекпоты, фото)

  // ---------- EVENTS: LIST ----------
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AccountRole.ADMIN, AccountRole.CROUPIER)
  @Get(':id/events')
  findEvents(@Param('id') id: string) {
    return this.casinoService.findEvents(id);
  }

  // ---------- EVENTS: CREATE ----------
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AccountRole.ADMIN, AccountRole.CROUPIER)
  @Post(':id/events')
  addEvent(@Req() req, @Param('id') id: string, @Body() body: CasinoEventDto) {
    return this.casinoService.addEvent(id, body, req.user);
  }

  // ---------- EVENTS: UPDATE ----------
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AccountRole.ADMIN, AccountRole.CROUPIER)
  @Put(':id/events/:eventId')
  updateEvent(
    @Req() req,
    @Param('id') id: string,
    @Param('eventId') eventId: string,
    @Body() body: UpdateCasinoEventDto,
  ) {
    return this.casinoService.updateEvent(id, eventId, body, req.user);
  }

  // ---------- EVENTS: DELETE ----------
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AccountRole.ADMIN, AccountRole.CROUPIER)
  @Delete(':id/events/:eventId')
  deleteEvent(@Req() req, @Param('id') id: string, @Param('eventId') eventId: string) {
    return this.casinoService.deleteEvent(id, eventId, req.user);
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

    return this.casinoService.update(id, {
      ...body,
      ...(imageUrl ? { image_url: imageUrl } : {}),
      ...(body.latitude != null ? { latitude: parseFloat(body.latitude) } : {}),
      ...(body.longitude != null ? { longitude: parseFloat(body.longitude) } : {}),
    }, req.user);
  }

  // ---------- DELETE ----------
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.casinoService.delete(id);
  }

  // ---------- GEOCODE ----------
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post('geocode')
  async geocode(@Body('ids') ids: string[] = []) {
    return this.casinoService.geocode(ids);
  }
}
