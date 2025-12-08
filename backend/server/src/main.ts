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

  app.enableCors({
    origin: '*', // для теста можно так, потом ограничить домен
  });

  // Статические файлы (картинки)
  app.useStaticAssets(join(__dirname, '..', 'uploads'), {
    prefix: '/uploads/', // URL будет http://localhost:3000/uploads/filename.jpg
  });

  app.enableCors({ origin: 'http://localhost:45347' }); 
  
  await app.listen(3000, '0.0.0.0');
}
bootstrap();
