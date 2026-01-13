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
} from '@nestjs/common';

import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { StatisticsService } from './statistics.service';
import * as path from 'path';
import { v4 as uuid } from 'uuid';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { AdminGuard } from 'src/auth/guards/admin.guard';

@Controller('statistics')
export class StatisticsController {
  constructor(private readonly statisticsService: StatisticsService) {}

  // ---------- GET ALL ----------
  @Get()
  findAll() {
    return this.statisticsService.findAll();
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
