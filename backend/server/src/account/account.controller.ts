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
  BadRequestException,
} from '@nestjs/common';

import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { AccountService } from './account.service';
import * as path from 'path';
import { v4 as uuid } from 'uuid';

@Controller('account')
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  // ----------------------------------------------------------
  // 1) generateBonusCode
  // ----------------------------------------------------------
  @Post(':id/generate-bonus')
  async generateBonusCode(@Param('id') accountId: string) {
    const code = await this.accountService.generateBonusCode(accountId);
    return { success: true, bonus_code: code };
  }

  // ----------------------------------------------------------
  // 2) verifyBonusCode
  // ----------------------------------------------------------
  @Post(':id/verify-bonus')
  async verifyBonusCode(
    @Param('id') accountId: string,
    @Body('card_id') card_id: string,
    @Body('code') code: string,
  ) {
    if (!card_id || !code) throw new BadRequestException('card_id and code are required');

    return await this.accountService.verifyBonusCode(accountId, card_id, code);
  }


  // ----------------------------------------------------------
  // 3) bindCard — привязка карты
  // ----------------------------------------------------------
  @Post(':id/bind-card')
  async bindCard(
    @Param('id') accountId: string,
    @Body('card_id') card_id: string,
    @Body('city') city: string,
  ) {
    if (!card_id || !city)
      throw new BadRequestException('card_id and city are required');

    const result = await this.accountService.bindCard(accountId, card_id, city);
    return { success: true, card: result };
  }

  // ----------------------------------------------------------
  // 4) listCards
  // ----------------------------------------------------------
  @Get(':id/cards')
  async listCards(@Param('id') accountId: string) {
    const cards = await this.accountService.listCards(accountId);
    return { success: true, cards };
  }

  // ----------------------------------------------------------
  // 5) removeCard
  // ----------------------------------------------------------
  @Delete(':id/cards/:cardId')
  async removeCard(
    @Param('id') accountId: string,
    @Param('cardId') cardId: string,
  ) {
    const result = await this.accountService.removeCard(accountId, cardId);
    return { success: true, removed: result };
  }
  
  // ---------- GET ALL ----------
  @Get()
  findAll() {
    return this.accountService.findAll();
  }

  // ---------- GET ONE ----------
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.accountService.findOne(id);
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
      : `/uploads/profile4.png`; // дефолт

    return this.accountService.create({
      balance: body.balance,
      bonus_balance: body.bonus_balance,
      fake_balance: body.fake_balance,
      login: body.login,
      password: body.password,
      google_id: body.google_id,
      apple_id: body.apple_id,
      last_spin_date: body.last_spin_date,
      image_url: imageUrl,
    });
  }

  // ---------- CREATE через JSON (уже загруженные файлы) ----------
  @Post('json')
  async createJson(@Body() body: any) {
    const imageUrl = body.image_url ? `/uploads/${body.image_url}` : `/uploads/logo_magic_city5.png`;
    return this.accountService.create({ ...body, image_url: imageUrl });
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

    return this.accountService.update(id, {
      ...body,
      ...(imageUrl ? { image_url: imageUrl } : {}),
    });
  }

  // ---------- DELETE ----------
  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.accountService.delete(id);
  }
}
