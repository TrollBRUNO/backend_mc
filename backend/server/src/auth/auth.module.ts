import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';

import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { Account, AccountSchema } from '../account/account.schema';
import { RefreshSession, RefreshSessionSchema } from './refresh-session.schema';

import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Account.name, schema: AccountSchema },
      { name: RefreshSession.name, schema: RefreshSessionSchema },
    ]),
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
  ],
  controllers: [AuthController],
  exports: [
    JwtModule,
  ],
})
export class AuthModule {}
