import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  BadRequestException,
} from '@nestjs/common';

import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { WheelService } from './wheel.service';
import * as path from 'path';
import { v4 as uuid } from 'uuid';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

@Controller('wheel')
export class WheelController {
  constructor(private readonly wheelService: WheelService) {}

  // ---------- GET ALL ----------
  @Get()
  findAll() {
    return this.wheelService.findAll();
  }

  // ---------- GET ONE ----------
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.wheelService.findOne(id);
  }

  // ---------- CREATE (multipart/form-data для файла) ----------
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post('create')
  async create(@Body('value') value: number) {
    if (typeof value !== 'number') {
      throw new BadRequestException('value must be a number');
    }

    return this.wheelService.create({ value });
  }
  
  // ---------- CREATE через JSON ----------
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post('json')
  async createJson(@Body() body: any) {
    return this.wheelService.create({
      value: body.value,
    });
  }

  // ---------- UPDATE ----------
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Put(':id')
  async update(@Param('id') id: string, @Body() body: any) {
    return this.wheelService.update(id, {
      ...body,
    });
  }

  // ---------- DELETE ----------
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.wheelService.delete(id);
  }

  // ---------- SPIN ----------
  @UseGuards(JwtAuthGuard)
  @Post('spin')
  async spin(@Req() req, @Body('wheel') wheel: number[]) {
    if (!Array.isArray(wheel) || wheel.length === 0) {
      throw new BadRequestException('wheel is required');
    }

    return this.wheelService.spin(req.user.sub, wheel);
  }

  // ---------- DEMO STATUS ----------
  @Get('demo/status')
  async demoStatus(@Query('demo_id') demoId: string) {
    if (!demoId) throw new BadRequestException('demo_id is required');
    return this.wheelService.getDemoStatus(demoId);
  }

  // ---------- DEMO SPIN (публичный) ----------
  @Post('demo/spin')
  async demoSpin(@Body('demo_id') demoId: string) {
    if (!demoId) throw new BadRequestException('demo_id is required');
    return this.wheelService.demoSpin(demoId);
  }

  // ---------- DEMO CLAIM ----------
  @UseGuards(JwtAuthGuard)
  @Post('demo/claim')
  async claimDemo(@Req() req, @Body('demo_id') demoId: string) {
    if (!demoId) throw new BadRequestException('demo_id is required');
    return this.wheelService.claimDemoBonus(req.user.sub, demoId);
  }
}
