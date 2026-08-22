import { Global, Module } from '@nestjs/common';
import { ImageService } from './image.service';

// Global: картинки принимают почти все контроллеры, и тащить импорт
// в каждый модуль отдельно смысла нет
@Global()
@Module({
  providers: [ImageService],
  exports: [ImageService],
})
export class UploadModule {}
