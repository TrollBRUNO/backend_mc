import {
  Controller,
  Post,
  Body,
  BadRequestException,
  Req,
} from '@nestjs/common';

import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  login(@Body() dto: LoginDto, @Req() req) {
    if (!dto.login || !dto.password) {
      throw new BadRequestException('MISSING_CREDENTIALS');
    }

    return this.authService.login(dto, req);
  }

  @Post('refresh')
  refresh(@Body('refresh_token') token: string) {
    if (!token) {
      throw new BadRequestException('REFRESH_TOKEN_REQUIRED');
    }

    return this.authService.refresh(token);
  }

  @Post('logout')
  logout(@Body('refresh_token') token: string) {
    if (!token) {
      throw new BadRequestException('REFRESH_TOKEN_REQUIRED');
    }

    return this.authService.logout(token);
  }
}
