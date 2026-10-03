import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';

import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { AccountSecurityController } from './account-security.controller';
import { Account, AccountSchema } from '../account/account.schema';
import { AccountModule } from '../account/account.module';
import { RefreshSession, RefreshSessionSchema } from './refresh-session.schema';
import { AuthSettings, AuthSettingsSchema } from './auth-settings.schema';
import { AuthSettingsService } from './auth-settings.service';
import { FirebaseIdentityService } from './firebase-identity.service';

import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Account.name, schema: AccountSchema },
      { name: RefreshSession.name, schema: RefreshSessionSchema },
      { name: AuthSettings.name, schema: AuthSettingsSchema },
    ]),
    // Регистрация через Google, Apple и телефон и вкладка Settings
    AccountModule,
    // registerAsync, а не register: process.env читается до того, как
    // ConfigModule успевает подхватить .env, и секрет молча оказывался пустым
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.get<string>('JWT_SECRET');
        if (!secret) {
          throw new Error('JWT_SECRET is not set — добавьте его в .env');
        }
        return { secret };
      },
    }),
  ],
  providers: [
    AuthService,
    JwtStrategy,
    FirebaseIdentityService,
    AuthSettingsService,
  ],
  controllers: [AuthController, AccountSecurityController],
  exports: [
    JwtModule,
  ],
})
export class AuthModule {}
