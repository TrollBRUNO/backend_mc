import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { JackpotSettingsService } from './jackpot-settings.service';
import { UpdateJackpotSettingsDto } from './dto/update-jackpot-settings.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

@Controller('jackpot-settings')
export class JackpotSettingsController {
  constructor(private readonly service: JackpotSettingsService) {}

  // Публично: рамки шкал нужны экрану уведомлений, а он открывается
  // и до авторизации
  @Get()
  get() {
    return this.service.get();
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Put()
  update(@Body() dto: UpdateJackpotSettingsDto) {
    return this.service.update(dto);
  }
}
