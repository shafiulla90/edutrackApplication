import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import express from 'express';
import { ExpressAdapter } from '@nestjs/platform-express';
import * as path from 'path';

// Safe multi-path loader for compiled NestJS AppModule
let AppModule: any;
try {
  const imported = require('../dist/app.module');
  AppModule = imported.AppModule || imported.default;
} catch (e1) {
  try {
    const imported = require('./dist/app.module');
    AppModule = imported.AppModule || imported.default;
  } catch (e2) {
    const imported = require(path.join(process.cwd(), 'dist', 'app.module'));
    AppModule = imported.AppModule || imported.default;
  }
}

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

export default async function handler(req: any, res: any) {
  try {
    await bootstrap();
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
