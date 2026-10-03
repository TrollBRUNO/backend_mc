import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  BadRequestException,
  Req,
  UseGuards,
} from '@nestjs/common';

import { AuthService } from './auth.service';
import { AuthSettingsService } from './auth-settings.service';
import { LoginDto } from './dto/login.dto';
import { ConfigService } from '@nestjs/config';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { timingSafeEqual } from 'crypto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AdminGuard } from './guards/admin.guard';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
    private readonly authSettings: AuthSettingsService,
  ) {}

  @Throttle({ global: { ttl: 60000, limit: 20 } })
  @Post('login')
  login(@Body() dto: LoginDto, @Req() req) {
    if (!dto.login || !dto.password) {
      throw new BadRequestException('MISSING_CREDENTIALS');
    }

    return this.authService.login(dto, req);
  }

  // Вход через Google, Apple или телефон: id_token — ID-токен Firebase
  @Throttle({ global: { ttl: 60000, limit: 30 } })
  @Post('firebase')
  signInWithFirebase(@Body('id_token') idToken: string, @Req() req) {
    return this.authService.signInWithFirebase(idToken, req);
  }

  // «Создать новый аккаунт» с токеном регистрации из /auth/firebase
  @Throttle({ global: { ttl: 60000, limit: 20 } })
  @Post('firebase/register')
  registerWithFirebase(@Body() body: any, @Req() req) {
    return this.authService.registerWithFirebase(body ?? {}, req);
  }

  // «У меня уже есть аккаунт»: вход паролем с привязкой нового способа
  @Throttle({ global: { ttl: 60000, limit: 20 } })
  @Post('firebase/link-existing')
  linkExistingWithPassword(@Body() body: any, @Req() req) {
    if (!body?.login || !body?.password) {
      throw new BadRequestException('MISSING_CREDENTIALS');
    }

    return this.authService.linkExistingWithPassword(body, req);
  }

  // Какие кнопки входа показывать в приложении
  @Get('methods')
  async methods() {
    const settings = await this.authSettings.get();
    return { phone: settings.phone_login_enabled };
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('settings')
  getSettings() {
    return this.authSettings.get();
  }

  // Выключатель входа по телефону в админке
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Put('settings')
  updateSettings(@Body() body: { phone_login_enabled?: boolean }) {
    return this.authSettings.update(body);
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
