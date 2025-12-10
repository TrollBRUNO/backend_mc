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
import { SupportService } from './support.service';
import * as path from 'path';
import { v4 as uuid } from 'uuid';

@Controller('support')
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  // ---------- GET ALL ----------
  @Get()
  findAll() {
    return this.supportService.findAll();
  }

  // ---------- GET ONE ----------
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.supportService.findOne(id);
  }

  // ---------- CREATE (multipart/form-data для файла) ----------
  @Post()
  async create(@Body() body: any) {
    return this.supportService.create({
      description_problem: body.description_problem,
      user_id: body.user_id,
      status: body.status,
    });
  }
  
  // ---------- CREATE через JSON ----------
  @Post('json')
  async createJson(@Body() body: any) {
    return this.supportService.create({
      description_problem: body.description_problem,
      user_id: body.user_id,
      status: body.status ?? 'open',
    });
  }

  // ---------- UPDATE ----------
  @Put(':id')
  async update(@Param('id') id: string, @Body() body: any) {
    return this.supportService.update(id, {
      ...body,
    });
  }

  // ---------- DELETE ----------
  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.supportService.delete(id);
  }
}
