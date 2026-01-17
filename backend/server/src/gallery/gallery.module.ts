import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Gallery, GallerySchema } from './gallery.schema';
import { GalleryService } from './gallery.service';
import { GalleryController } from './gallery.controller';
import { Account, AccountSchema } from 'src/account/account.schema';
import { PushService } from 'src/push/push.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Gallery.name, schema: GallerySchema },
      { name: Account.name, schema: AccountSchema },
    ])
  ],
  providers: [GalleryService, PushService],
  controllers: [GalleryController]
})
export class GalleryModule {}
