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
import { AdminGuard } from '../auth/guards/admin.guard';
import { PushService } from '../push/push.service';
import { Locale } from '../push/push-locales';
import { Throttle } from '@nestjs/throttler';

@Controller('account')
export class AccountController {
  constructor(
      private readonly accountService: AccountService, 
      private readonly pushService: PushService,
    ) {}

  // ----------------------------------------------------------
  // 1) generateBonusCode
  // ----------------------------------------------------------
  // accountId берётся из токена, а не из URL: по :id любой залогиненный
  // мог сгенерировать бонус-код на чужой аккаунт
  @UseGuards(JwtAuthGuard)
  @Post(':id/generate-bonus')
  async generateBonusCode(@Req() req) {
    const code = await this.accountService.generateBonusCode(req.user.sub);
    return { success: true, bonus_code: code };
  }

  // ----------------------------------------------------------
  // 2) verifyBonusCode
  // ----------------------------------------------------------
  @UseGuards(JwtAuthGuard)
  @Post(':id/verify-bonus')
  async verifyBonusCode(
    @Req() req,
    @Body('card_id') card_id: string,
    @Body('code') code: string,
  ) {
    if (!card_id || !code) throw new BadRequestException('card_id and code are required');

    return await this.accountService.verifyBonusCode(req.user.sub, card_id, code);
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
    if (!dto.card_id || !dto.casino_id) {
      throw new BadRequestException('card_id and casino_id are required');
    }

    const card = await this.accountService.bindCard(req.user.sub, dto);
    return { success: true, card };
  }

  // ----------------------------------------------------------
  // 4) listCards
  // ----------------------------------------------------------
  // Отдаёт карты произвольного аккаунта — только админу.
  // Пользователь свои карты берёт через /account/get-profile-cards
  @UseGuards(JwtAuthGuard, AdminGuard)
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
  async checkCard(
    @Body('card_id') cardId: string,
    // Необязателен ради старых клиентов: без него проверка идёт по всей базе,
    // как раньше. Новый клиент присылает зал и получает проверку в его пределах
    @Body('casino_id') casinoId?: string,
  ) {
    if (!cardId) {
      throw new BadRequestException('card_id_required');
    }

    await this.accountService.checkCardAvailability(cardId, casinoId);

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
  @UseGuards(JwtAuthGuard, AdminGuard)
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
  @Throttle({ global: { ttl: 60000, limit: 20 } })
  @Post('register')
  async register(@Body() dto: any) {
    const { login, password, realname, cards, role, locale, notification_preference } = dto;

    if (!login || !password || !realname) {
      throw new BadRequestException('MISSING_FIELDS');
    }

    return await this.accountService.register({
      login,
      password,
      realname,
      cards,
      role,
      locale,
      // Выбор городов и сетей на шаге регистрации — необязательный
      notification_preference,
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
      fake_balance_int: account.fake_balance ?? 0,
      last_credit_take_date: account.last_credit_take_date ?? null,
      role: account.role,
      image_url: account.image_url,
      locale: account.locale ?? 'bg',
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
  // Заведение аккаунта руками — только админ. Обычные пользователи
  // приходят через /account/register
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
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post('json')
  async createJson(@Body() body: any) {
    const imageUrl = body.image_url ? `/uploads/${body.image_url}` : `/uploads/logo_magic_city5.png`;
    return this.accountService.create({ ...body, image_url: imageUrl });
  }

  // ---------- UPDATE NOTIFICATIONS ----------
  @Put('notifications')
  @UseGuards(JwtAuthGuard)
  async updateNotifications(@Req() req, @Body() body: any) {
    console.log('🔧 updateNotifications body:', body);
    return this.accountService.updateNotificationSettings(req.user.sub, body);
  }

  // ---------- UPDATE ----------
  // Только админ: раньше стоял один JwtAuthGuard, и любой залогиненный
  // мог обновить любой аккаунт, включая собственную роль.
  // Набор изменяемых полей ограничен в AccountService.update
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

    return this.accountService.update(id, {
      ...body,
      ...(imageUrl ? { image_url: imageUrl } : {}),
    });
  }

  // ---------- DELETE ----------
  // Раньше стояла вообще без guard — удалить любой аккаунт мог кто угодно
  // без единого токена
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.accountService.delete(id);
  }

  // ----------------------------------------------------------
  //  FULL ACCOUNT STATS (ADMIN ONLY)
  // ----------------------------------------------------------
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('full/all')
  async getAllFullStats() {
    return this.accountService.getAllFullStats();
  }

  // ---------- RESET PASSWORD (ADMIN ONLY) ----------
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post(':id/reset-password')
  async resetPassword(@Param('id') id: string) {
    return this.accountService.generateTemporaryPassword(id);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('search/:query')
  async search(@Param('query') query: string) {
    return this.accountService.search(query);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('sort/:field/:direction')
  async sort(
    @Param('field') field: string,
    @Param('direction') direction: 'asc' | 'desc'
  ) {
    return this.accountService.sort(field, direction);
  }

  // Привязка карты чужому аккаунту — только админу. Раньше админка слала
  // сюда POST /account/bind-card, а тот берёт аккаунт из токена, то есть
  // карта уходила на аккаунт самого админа, а не того, кого он редактирует
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post(':id/cards')
  async addCardForAccount(
    @Param('id') accountId: string,
    @Body() dto: BindCardDto,
  ) {
    if (!dto.card_id || !dto.casino_id) {
      throw new BadRequestException('card_id and casino_id are required');
    }

    const card = await this.accountService.bindCard(accountId, dto);
    return { success: true, card };
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Put(':id/cards/:cardId')
  async updateCard(
    @Param('id') accountId: string,
    @Param('cardId') cardId: string,
    @Body() dto: any
  ) {
    return this.accountService.updateCard(accountId, cardId, dto);
  }

  // Список залов с признаком «шлём ли уведомления» для экрана настроек
  @UseGuards(JwtAuthGuard)
  @Get('casino-notifications')
  async getCasinoNotifications(@Req() req) {
    return this.accountService.getCasinoNotifications(req.user.sub);
  }

  // Ручной переключатель одного зала. enabled: null снимает отметку
  // и отдаёт зал обратно автоматике
  @UseGuards(JwtAuthGuard)
  @Put('casino-notifications/:casinoId')
  async setCasinoNotification(
    @Req() req,
    @Param('casinoId') casinoId: string,
    @Body('enabled') enabled: boolean | null,
  ) {
    return this.accountService.setCasinoNotification(
      req.user.sub,
      casinoId,
      enabled === null || enabled === undefined ? null : Boolean(enabled),
    );
  }

  // Города и сети, по которым человек хочет слышать о джекпотах.
  // Выбирается при регистрации и правится потом из настроек
  @UseGuards(JwtAuthGuard)
  @Get('notification-preference')
  async getNotificationPreference(@Req() req) {
    return this.accountService.getNotificationPreference(req.user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Put('notification-preference')
  async updateNotificationPreference(
    @Req() req,
    @Body() body: { cities?: string[]; brands?: string[] },
  ) {
    return this.accountService.updateNotificationPreference(req.user.sub, body);
  }

  // Приложение шлёт координаты на старте, если разрешение уже выдано.
  // По ним подбираются ближайшие залы тем, у кого нет привязанной карты
  @UseGuards(JwtAuthGuard)
  @Post('location')
  async updateLocation(
    @Req() req,
    @Body('lat') lat: number,
    @Body('lng') lng: number,
  ) {
    return this.accountService.updateLocation(req.user.sub, lat, lng);
  }

  @UseGuards(JwtAuthGuard)
  @Get('notifications')
  async getNotifications(@Req() req) {
    return this.accountService.getNotificationSettings(req.user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Post('push-test')
  async pushTest(@Req() req) {
    const acc = await this.accountService.findOne(req.user.sub);

    await this.pushService.sendLocalized(acc.fcm_token, 'test', acc.locale);

    return { ok: true };
  }

  @UseGuards(JwtAuthGuard)
  @Post('fcm-token')
  async saveFcmToken(@Req() req, @Body('token') token: string) {
    await this.accountService.updateFcmToken(req.user.sub, token);
    return { ok: true };
  }

  @UseGuards(JwtAuthGuard)
  @Post('locale')
  async updateLocale(@Req() req, @Body('locale') locale: string) {
    const normalized = locale?.toLowerCase();
    if (!(Object.values(Locale) as string[]).includes(normalized)) {
      throw new BadRequestException('INVALID_LOCALE');
    }

    await this.accountService.update(req.user.sub, { locale: normalized });
    return { ok: true, locale: normalized };
  }
}
