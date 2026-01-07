import {
  Body,
  Controller,
  Post,
  UseGuards,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BonusCodeService } from './bonus-code.service';
import { ApiKeyGuard } from '../auth/guards/api-key.guard';

@Controller('bonus-code')
export class BonusCodeController {
  constructor(private readonly bonusCodeService: BonusCodeService) {}

  // --------------------------------------------------
  // 1) Генерация бонус-кода (пользователь)
  // --------------------------------------------------
  @UseGuards(JwtAuthGuard)
  @Post('generate')
  async generate(@Req() req) {
    return await this.bonusCodeService.generateBonusCode(req.user.sub);
  }

  // --------------------------------------------------
  // 2) Проверка бонус-кода (кассир)
  // --------------------------------------------------
  @UseGuards(ApiKeyGuard)
  @Post('verify')
  async verify(
    @Body('card_id') cardId: string,
    @Body('code') code: string,
  ) {
    if (!cardId || !code) {
      throw new BadRequestException('card_id and code are required');
    }

    return await this.bonusCodeService.verifyBonusCode(cardId, code);
  }
}
