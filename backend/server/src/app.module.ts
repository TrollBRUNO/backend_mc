import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MongooseModule } from '@nestjs/mongoose';
import { NewsModule } from './news/news.module';
import { GalleryModule } from './gallery/gallery.module';

@Module({
  imports: [
    MongooseModule.forRoot('mongodb://localhost:27017/mydb'),
    NewsModule,
    GalleryModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
