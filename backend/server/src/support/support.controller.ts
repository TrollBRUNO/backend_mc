import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';

import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { SupportService } from './support.service';
import * as path from 'path';
import { v4 as uuid } from 'uuid';
import { AdminGuard } from 'src/auth/guards/admin.guard';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

@Controller('support')
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  // ---------- GET ALL ----------
  @Get()
  findAll() {
    return this.supportService.findAll();
  }

  // ---------- GET ONE ----------
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.supportService.findOne(id);
  }

  // ---------- CREATE (multipart/form-data для файла) ----------
  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@Body() body: any) {
    return this.supportService.create({
      description_problem: body.description_problem,
      user_id: body.user_id,
      status: body.status,
    });
  }
  
  // ---------- CREATE через JSON ----------
  @UseGuards(JwtAuthGuard)
  @Post('json')
  async createJson(@Body() body: any) {
    return this.supportService.create({
      description_problem: body.description_problem,
      user_id: body.user_id,
      status: body.status ?? 'open',
    });
  }

  // ---------- UPDATE ----------
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Put(':id')
  async update(@Param('id') id: string, @Body() body: any) {
    return this.supportService.update(id, {
      ...body,
    });
  }

  // ---------- DELETE ----------
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.supportService.delete(id);
  }
}
