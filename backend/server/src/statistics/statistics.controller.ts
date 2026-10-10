import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
  Query,
} from '@nestjs/common';
import { WheelStatsService } from './wheel-stats.service';
import { sofiaDayEnd, sofiaDayStart } from './sofia-time';

import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { StatisticsService } from './statistics.service';
import * as path from 'path';
import { v4 as uuid } from 'uuid';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

@Controller('statistics')
export class StatisticsController {
  constructor(
    private readonly statisticsService: StatisticsService,
    private readonly wheelStats: WheelStatsService,
  ) {}

  // ---------- GET ALL ----------
  // Только админу: раньше без guard любой мог выгрузить все прокрутки
  // всех игроков. Приложение этот список не запрашивает
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get()
  findAll() {
    return this.statisticsService.findAll();
  }

  // ---------- КОЛЕСО: СВОДКА ----------
  // from, to — даты 'YYYY-MM-DD' по Софии, обе включительно.
  // Без них — за всё время
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('wheel/summary')
  wheelSummary(@Query('from') from?: string, @Query('to') to?: string) {
    return this.wheelStats.summary(
      from ? sofiaDayStart(from) : undefined,
      to ? sofiaDayEnd(to) : undefined,
    );
  }

  // ---------- КОЛЕСО: ИСТОРИЯ ИГРОКА ----------
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('wheel/account/:accountId')
  wheelAccountHistory(@Param('accountId') accountId: string) {
    return this.wheelStats.accountHistory(accountId);
  }

  // ---------- GET STATISTICS FOR ACCOUNT ----------
  @UseGuards(JwtAuthGuard)
  @Get('get-profile-stats')
  getStatistics(@Req() req) {
    const accountId = req.user.sub;
    return this.statisticsService.getStatistics(accountId);
  }

  // ---------- GET ONE ----------
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.statisticsService.findOne(id);
  }

  // ---------- CREATE (multipart/form-data для файла) ----------
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post()
  async create(@Body() body: any) {
    return this.statisticsService.create({
      spin_date: body.spin_date,
      prize_count: body.prize_count,
      user_id: body.user_id,
    });
  }
  
  // ---------- CREATE через JSON ----------
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post('json')
  async createJson(@Body() body: any) {
    return this.statisticsService.create({
      spin_date: body.spin_date,
      prize_count: body.prize_count,
      user_id: body.user_id,
    });
  }

  // ---------- UPDATE ----------
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Put(':id')
  async update(@Param('id') id: string, @Body() body: any) {
    return this.statisticsService.update(id, {
      ...body,
    });
  }

  // ---------- DELETE ----------
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.statisticsService.delete(id);
  }
}
