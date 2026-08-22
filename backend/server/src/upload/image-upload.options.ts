import { BadRequestException } from '@nestjs/common';
import { memoryStorage } from 'multer';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';

// Верхняя граница того, что вообще принимаем. Не путать с целевым весом:
// сюда приходит оригинал с телефона, а ужимает его до полумегабайта
// ImageService уже после приёма
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

/**
 * Общие настройки приёма картинок.
 *
 * memoryStorage, а не diskStorage: файл нужно пережать перед сохранением,
 * иначе на диск сначала лёг бы десятимегабайтный оригинал, который потом
 * пришлось бы перечитывать и удалять.
 */
export const imageUploadOptions: MulterOptions = {
  storage: memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES },
  fileFilter: (_req, file, cb) => {
    // iPhone отдаёт HEIC — sharp его понимает, но раньше такой файл
    // просто ложился на диск и не открывался в браузере
    if (!ALLOWED.includes(file.mimetype)) {
      return cb(new BadRequestException('UNSUPPORTED_IMAGE_TYPE'), false);
    }
    cb(null, true);
  },
};
