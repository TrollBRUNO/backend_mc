/* import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import { join } from 'path';
import fastifyStatic from '@fastify/static';
import multipart from '@fastify/multipart';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );

  await app.register(multipart);

  app.register(fastifyStatic, {
    root: join(__dirname, '..', 'uploads'),
    prefix: '/uploads/',
  });

  await app.listen(3000, '0.0.0.0');
}

bootstrap(); */

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Сервер стоит за nginx, и без этого req.ip у каждого запроса был адресом
  // nginx. Лимиты ThrottlerGuard считались на всех игроков разом: 400
  // запросов в минуту на всё приложение и 20 входов в минуту на всех.
  // Доверяем X-Forwarded-For только от адресов внутренних сетей (там nginx),
  // так что снаружи подставить себе чужой IP не выйдет
  app.set('trust proxy', 'loopback, linklocal, uniquelocal');

  app.enableCors({
    origin: '*',
    methods: '*',
    allowedHeaders: '*',
  });

  // Статические файлы (картинки)
  app.useStaticAssets(join(__dirname, '..', 'uploads'), {
    prefix: '/uploads/', // URL будет http://localhost:3000/uploads/filename.jpg
  });

  //app.enableCors({ origin: 'http://localhost:41966' }); 
  
  await app.listen(3000, '0.0.0.0');
}

bootstrap();
