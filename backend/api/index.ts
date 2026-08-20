import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import * as express from 'express';
import { ExpressAdapter } from '@nestjs/platform-express';
import { AppModule } from '../src/app.module';

const server = express();
let cachedApp: any;

async function bootstrap() {
  if (!cachedApp) {
    const app = await NestFactory.create(AppModule, new ExpressAdapter(server), {
      logger: ['error', 'warn', 'log'],
    });
    app.enableCors({
      origin: true,
      credentials: true,
    });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    cachedApp = app;
  }
  return cachedApp;
}

function normalizeUrl(url: string): string {
  if (!url) return '/';
  let path = url;
  let query = '';
  const queryIndex = url.indexOf('?');
  if (queryIndex !== -1) {
    path = url.substring(0, queryIndex);
    query = url.substring(queryIndex);
  }

  if (path.startsWith('/api/index.ts')) {
    path = path.substring(13);
  } else if (path.startsWith('/api/index')) {
    path = path.substring(10);
  }

  if (!path || path === '') path = '/';
  if (!path.startsWith('/')) path = '/' + path;

  return path + query;
}

export default async function handler(req: any, res: any) {
  try {
    await bootstrap();
    if (req.url) {
      req.url = normalizeUrl(req.url);
    }
    server(req, res);
  } catch (error: any) {
    console.error('CRITICAL SERVERLESS BOOTSTRAP ERROR:', error);
    res.status(500).json({
      error: 'Serverless Bootstrap Failed',
      message: error?.message || String(error),
      stack: error?.stack || null,
    });
  }
}

module.exports = handler;
module.exports.default = handler;


