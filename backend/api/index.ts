import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import express from 'express';
import { ExpressAdapter } from '@nestjs/platform-express';

// Import AppModule directly from src/app.module
// Vercel's @vercel/node builder automatically compiles and traces all NestJS TypeScript files in src/!
// eslint-disable-next-line @typescript-eslint/no-var-requires
let AppModule: any;
try {
  AppModule = require('../src/app.module').AppModule;
} catch (e) {
  AppModule = require('./src/app.module').AppModule;
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
