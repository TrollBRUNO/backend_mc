import {
  Controller,
  Post,
  Body,
  BadRequestException,
  Req,
} from '@nestjs/common';

import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ConfigService } from '@nestjs/config';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { timingSafeEqual } from 'crypto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService, private readonly configService: ConfigService) {}

  @Throttle({ global: { ttl: 60000, limit: 20 } })
  @Post('login')
  login(@Body() dto: LoginDto, @Req() req) {
    if (!dto.login || !dto.password) {
      throw new BadRequestException('MISSING_CREDENTIALS');
    }

    return this.authService.login(dto, req);
  }

  // Обновление токенов не держим под общим лимитом: под ним сидят все
  // игроки одного Wi-Fi зала, а отказ 429 старые версии приложения
  // принимали за конец сессии и разлогинивали
  @SkipThrottle({ global: true })
  @Post('refresh')
  refresh(@Body('refresh_token') token: string, @Req() req) {
    if (!token) {
      throw new BadRequestException('REFRESH_TOKEN_REQUIRED');
    }

    return this.authService.refresh(token, req);
  }

  @Post('logout')
  logout(@Body('refresh_token') token: string) {
    if (!token) {
      throw new BadRequestException('REFRESH_TOKEN_REQUIRED');
    }

    return this.authService.logout(token);
  }

  // Ни присланный, ни настоящий код в лог не пишем: раньше здесь
  // печатался ADMIN_SECRET_CODE, и его видел любой с доступом к логам
  @Throttle({ global: { ttl: 60000, limit: 10 } })
  @Post('admin-verify')
  async verifyAdmin(@Body('code') code: string) {
    const adminCode = this.configService.get<string>('ADMIN_SECRET_CODE');

    // Без заданного кода не пускаем никого: иначе запрос без кода
    // совпал бы с пустой настройкой
    if (!adminCode || typeof code !== 'string') {
      return { ok: false };
    }

    const given = Buffer.from(code);
    const expected = Buffer.from(adminCode);

    return {
      ok: given.length === expected.length && timingSafeEqual(given, expected),
    };
  }
}
