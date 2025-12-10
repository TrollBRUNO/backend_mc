import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
} from '@nestjs/common';

import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { StatisticsService } from './statistics.service';
import * as path from 'path';
import { v4 as uuid } from 'uuid';

@Controller('statistics')
export class StatisticsController {
  constructor(private readonly statisticsService: StatisticsService) {}

  // ---------- GET ALL ----------
  @Get()
  findAll() {
    return this.statisticsService.findAll();
  }

  // ---------- GET ONE ----------
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.statisticsService.findOne(id);
  }

  // ---------- CREATE (multipart/form-data для файла) ----------
  @Post()
  async create(@Body() body: any) {
    return this.statisticsService.create({
      spin_date: body.spin_date,
      prize_count: body.prize_count,
      user_id: body.user_id,
    });
  }
  
  // ---------- CREATE через JSON ----------
  @Post('json')
  async createJson(@Body() body: any) {
    return this.statisticsService.create({
      spin_date: body.spin_date,
      prize_count: body.prize_count,
      user_id: body.user_id,
    });
  }

  // ---------- UPDATE ----------
  @Put(':id')
  async update(@Param('id') id: string, @Body() body: any) {
    return this.statisticsService.update(id, {
      ...body,
    });
  }

  // ---------- DELETE ----------
  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.statisticsService.delete(id);
  }
}
