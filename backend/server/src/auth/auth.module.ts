import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
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
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'DEV_SECRET',
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
