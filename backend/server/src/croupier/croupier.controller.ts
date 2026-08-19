import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AccountRole } from '../auth/roles';
import { CroupierService } from './croupier.service';
import { AccountService } from '../account/account.service';
import { CreateCroupierDto, UpdateCroupierDto } from './dto/create-croupier.dto';
import { ActivityAction, ActivityEntity } from '../activity-log/activity-log.schema';

// Управление крупье и вся сводка для админки.
// Всё под админом, кроме /me — его зовёт сам крупье.
@Controller('croupiers')
export class CroupierController {
  constructor(
    private readonly croupierService: CroupierService,
    private readonly accountService: AccountService,
  ) {}

  // ---------- СВОЙ ПРОФИЛЬ И ДОСТУПНЫЕ ЗАЛЫ ----------
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AccountRole.ADMIN, AccountRole.CROUPIER)
  @Get('me')
  me(@Req() req) {
    return this.croupierService.me(req.user.sub);
  }

  // ---------- ОБЩАЯ ЛЕНТА ДЕЙСТВИЙ ----------
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('activity')
  activity(
    @Query('account_id') accountId?: string,
    @Query('entity') entity?: ActivityEntity,
    @Query('action') action?: ActivityAction,
    @Query('casino_id') casinoId?: string,
    @Query('limit') limit?: string,
    @Query('skip') skip?: string,
  ) {
    return this.croupierService.activity({
      account_id: accountId,
      entity,
      action,
      casino_id: casinoId,
      limit: limit ? parseInt(limit, 10) : undefined,
      skip: skip ? parseInt(skip, 10) : undefined,
    });
  }

  // ---------- СПИСОК КРУПЬЕ ----------
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get()
  findAll() {
    return this.croupierService.findAll();
  }

  // ---------- ОДИН КРУПЬЕ ----------
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.croupierService.findOne(id);
  }

  // ---------- ИСТОРИЯ СОЗДАННОГО ----------
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get(':id/history')
  history(
    @Param('id') id: string,
    @Query('entity') entity?: ActivityEntity,
    @Query('action') action?: ActivityAction,
    @Query('limit') limit?: string,
    @Query('skip') skip?: string,
  ) {
    return this.croupierService.history(id, {
      entity,
      action,
      limit: limit ? parseInt(limit, 10) : undefined,
      skip: skip ? parseInt(skip, 10) : undefined,
    });
  }

  // ---------- СОЗДАТЬ ----------
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post()
  create(@Body() dto: CreateCroupierDto) {
    return this.croupierService.create(dto);
  }

  // ---------- ИЗМЕНИТЬ (в т.ч. список залов и блокировка) ----------
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCroupierDto) {
    return this.croupierService.update(id, dto);
  }

  // ---------- ВРЕМЕННЫЙ ПАРОЛЬ ----------
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post(':id/reset-password')
  resetPassword(@Param('id') id: string) {
    return this.accountService.generateTemporaryPassword(id);
  }

  // ---------- УДАЛИТЬ ----------
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.croupierService.delete(id);
  }
}
