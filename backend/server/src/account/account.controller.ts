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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Patch, Req, UseGuards } from '@nestjs/common/decorators';
import { BindCardDto } from './dto/create-card.dto';

@Controller('account')
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  // ----------------------------------------------------------
  // 1) generateBonusCode
  // ----------------------------------------------------------
  @UseGuards(JwtAuthGuard)
  @Post(':id/generate-bonus')
  async generateBonusCode(@Param('id') accountId: string) {
    const code = await this.accountService.generateBonusCode(accountId);
    return { success: true, bonus_code: code };
  }

  // ----------------------------------------------------------
  // 2) verifyBonusCode
  // ----------------------------------------------------------
  @UseGuards(JwtAuthGuard)
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
  @UseGuards(JwtAuthGuard)
  @Post('bind-card')
  async bindCard(
    @Req() req,
    @Body() dto: BindCardDto,
  ) {
    if (!dto.card_id || !dto.city) {
      throw new BadRequestException('card_id and city are required');
    }

    const card = await this.accountService.bindCard(req.user.sub, dto);
    return { success: true, card };
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
  /* @UseGuards(JwtAuthGuard)
  @Delete(':id/cards/:cardId')
  async removeCard(
    @Param('id') accountId: string,
    @Param('cardId') cardId: string,
  ) {
    const result = await this.accountService.removeCard(accountId, cardId);
    return { success: true, removed: result };
  } */
  
  // ---------- REMOVE PROFILE CARD ----------
  @UseGuards(JwtAuthGuard)
  @Patch('cards/:cardId/deactivate')
  removeProfileCard(
    @Req() req,
    @Param('cardId') cardId: string,
  ) {
    return this.accountService.removeProfileCard(req.user.sub, cardId);
  }

  // ----------------------------------------------------------
  // 6) checkCard
  // ----------------------------------------------------------
  @Post('check-card')
  async checkCard(@Body('card_id') cardId: string) {
    if (!cardId) {
      throw new BadRequestException('card_id_required');
    }

    await this.accountService.checkCardAvailability(cardId);

    return { ok: true };
  }

  // ---------- CAN SPIN ----------
  @UseGuards(JwtAuthGuard)
  @Get('can-spin')
  canSpin(@Req() req) {
    return this.accountService.canSpin(req.user.sub);
  }

  // ---------- CAN TAKE CREDIT ----------
  @UseGuards(JwtAuthGuard)
  @Get('can-take')
  canTake(@Req() req) {
    return this.accountService.canTakeCredit(req.user.sub);
  }

  // ---------- TAKE CREDIT ----------
  @UseGuards(JwtAuthGuard)
  @Post('take-credit')
  takeCredit(@Req() req, @Body('amount') amount?: number) {
    return this.accountService.takeCredit(req.user.sub, amount);//amount);
  }

  // ---------- GET ALL ----------
  @Get()
  findAll() {
    return this.accountService.findAll();
  }

  // ---------- GET ONE ----------
  /* @UseGuards(JwtAuthGuard)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.accountService.findOne(id);
  } */

  // ---------- REGISTER ----------
  @Post('register')
  async register(@Body() dto: any) {
    const { login, password, realname, cards, role } = dto;

    if (!login || !password || !realname) {
      throw new BadRequestException('MISSING_FIELDS');
    }

    return await this.accountService.register({
      login,
      password,
      realname,
      cards,
      role
    });
  }

  // ---------- SHOW PROFILE ----------
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@Req() req) {
    const account = await this.accountService.findOne(req.user.sub);

    return {
      login: account.login,
      realname: account.realname,
      balance: account.balance ?? 0,
      bonus_balance: account.bonus_balance.toString() ?? 0,
      fake_balance: account.fake_balance.toString() ?? 0,
      last_credit_take_date: account.last_credit_take_date ?? null,
      role: account.role,
      image_url: account.image_url,
    };
  }

  // ---------- GET CARDS FOR ACCOUNT ----------
  @UseGuards(JwtAuthGuard)
  @Get('get-profile-cards')
  getProfileCards(@Req() req) {
    const accountId = req.user.sub;
    return this.accountService.getProfileCards(accountId);
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
