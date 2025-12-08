import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MongooseModule } from '@nestjs/mongoose';
import { NewsModule } from './news/news.module';
import { GalleryModule } from './gallery/gallery.module';
import { CasinoModule } from './casino/casino.module';

@Module({
  imports: [
    MongooseModule.forRoot('mongodb://localhost:27017/mydb'),
    NewsModule,
    GalleryModule,
    CasinoModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
