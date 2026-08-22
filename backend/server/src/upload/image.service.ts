import { Injectable, Logger } from '@nestjs/common';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { v4 as uuid } from 'uuid';
import sharp from 'sharp';

// Фотография с телефона — это 5–10 МБ, а показывается она в списке
// размером с половину экрана. Раньше файл клался на диск как есть,
// и пользователи качали эти мегабайты при каждом открытии ленты.

// Длинная сторона. Full HD с запасом: на телефоне и в вебе картинка
// показывается меньше, а деталей хватает и при рассматривании
const MAX_SIDE_PX = 1920;

// Целимся в мегабайт, а не в полмегабайта: этого достаточно, чтобы лента
// грузилась быстро, но качество не приходится ронять до артефактов
const TARGET_BYTES = 1024 * 1024;

// От лучшего качества к худшему, пока не уложимся в целевой вес.
// Нижняя ступень намеренно высокая — при таком запасе по весу
// опускаться ниже незачем
const QUALITY_STEPS = [88, 80, 72, 64];

const UPLOAD_DIR = join(process.cwd(), 'uploads');

@Injectable()
export class ImageService {
  private readonly logger = new Logger(ImageService.name);

  /**
   * Ужимает картинку и кладёт в uploads. Возвращает публичный путь.
   *
   * Формат всегда WebP: он заметно легче JPEG при том же качестве и
   * понимают его все браузеры и оба мобильных вебвью.
   */
  async save(buffer: Buffer): Promise<string> {
    const processed = await this.compress(buffer);

    const filename = `${uuid()}.webp`;

    await mkdir(UPLOAD_DIR, { recursive: true });
    await writeFile(join(UPLOAD_DIR, filename), processed);

    return `/uploads/${filename}`;
  }

  private async compress(buffer: Buffer): Promise<Buffer> {
    const base = sharp(buffer, { failOn: 'none' })
      // Поворачиваем по EXIF: снятое боком фото с телефона иначе
      // так и останется лежащим на боку
      .rotate()
      .resize({
        width: MAX_SIDE_PX,
        height: MAX_SIDE_PX,
        fit: 'inside',
        // Маленькую картинку не растягиваем
        withoutEnlargement: true,
      });

    let last = await base.clone().webp({ quality: QUALITY_STEPS[0] }).toBuffer();
    if (last.length <= TARGET_BYTES) return last;

    for (const quality of QUALITY_STEPS.slice(1)) {
      last = await base.clone().webp({ quality }).toBuffer();

      if (last.length <= TARGET_BYTES) return last;
    }

    // Не уложились даже на минимальном качестве — отдаём что получилось.
    // Это уже в разы меньше исходника, ронять загрузку из-за этого незачем
    this.logger.warn(
      `Картинка не ужалась до ${Math.round(TARGET_BYTES / 1024)} КБ: ` +
        `${Math.round(last.length / 1024)} КБ`,
    );

    return last;
  }
}

/**
 * Приводит присланное клиентом значение к публичному пути.
 *
 * Исторически админка слала только имя файла, а бэкенд сам приклеивал
 * префикс. Новый загрузчик отдаёт уже готовый `/uploads/xxx.webp`, и без
 * этой проверки получалось `/uploads//uploads/xxx.webp` — на этом ломались
 * превью в формах.
 */
export function toPublicImagePath(value?: string | null): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith('/uploads/') || trimmed.startsWith('http')) return trimmed;
  return `/uploads/${trimmed}`;
}
