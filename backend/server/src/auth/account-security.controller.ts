import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AuthService } from './auth.service';
import { FirebaseIdentityService } from './firebase-identity.service';
import { AuthSettingsService } from './auth-settings.service';
import { AccountIdentityService } from '../account/account-identity.service';
import { isIdentityProvider } from '../account/identity.util';

// Вкладка Settings: логин, пароль, привязанные способы входа, удаление.
// Всё — про аккаунт из токена, чужой аккаунт отсюда не тронуть
@UseGuards(JwtAuthGuard)
@Controller('account/me')
export class AccountSecurityController {
  constructor(
    private readonly accountIdentity: AccountIdentityService,
    private readonly firebaseIdentity: FirebaseIdentityService,
    private readonly authSettings: AuthSettingsService,
    private readonly authService: AuthService,
  ) {}

  @Get('security')
  getSecurity(@Req() req) {
    return this.accountIdentity.getSecurity(req.user.sub);
  }

  @Put('login')
  changeLogin(@Req() req, @Body('login') login: string) {
    return this.accountIdentity.changeLogin(req.user.sub, login);
  }

  // Текущий пароль подбирать перебором не дадим
  @Throttle({ global: { ttl: 60000, limit: 10 } })
  @Put('password')
  async setPassword(
    @Req() req,
    @Body() body: { new_password?: string; current_password?: string; id_token?: string },
  ) {
    // «Забыл пароль»: вместо текущего пароля — свежий вход через
    // привязанный Google, Apple или телефон
    const reauth = body?.id_token
      ? await this.firebaseIdentity.verify(body.id_token)
      : null;

    return this.accountIdentity.setPassword(req.user.sub, {
      new_password: body?.new_password,
      current_password: body?.current_password,
      reauth,
    });
  }

  @Post('identities')
  async linkIdentity(@Req() req, @Body('id_token') idToken: string) {
    const identity = await this.firebaseIdentity.verify(idToken);
    await this.authSettings.assertProviderEnabled(identity.provider);
    return this.accountIdentity.linkIdentity(req.user.sub, identity);
  }

  @Delete('identities/:provider')
  unlinkIdentity(@Req() req, @Param('provider') provider: string) {
    if (!isIdentityProvider(provider)) {
      throw new BadRequestException('UNKNOWN_PROVIDER');
    }
    return this.accountIdentity.unlinkIdentity(req.user.sub, provider);
  }

  // POST, а не DELETE /account/me: тот путь уже занят админским
  // DELETE /account/:id, и запрос ушёл бы туда
  @Post('delete')
  async deleteAccount(@Req() req) {
    await this.accountIdentity.softDelete(req.user.sub);
    await this.authService.revokeAllSessions(req.user.sub);
    return { success: true };
  }
}
