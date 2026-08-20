import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import express from 'express';
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
  let cleaned = url;
  if (cleaned.startsWith('/api/index')) {
    cleaned = cleaned.substring(10);
  } else if (cleaned.startsWith('/api')) {
    cleaned = cleaned.substring(4);
  }
  if (!cleaned || cleaned === '') return '/';
  if (!cleaned.startsWith('/')) return '/' + cleaned;
  return cleaned;
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
