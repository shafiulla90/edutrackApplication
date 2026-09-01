import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
const express = require('express');
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
      methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type',
        'Accept',
        'Authorization',
        'X-Tenant-ID',
        'X-Requested-With',
        'X-Academic-Year-ID',
      ],
      credentials: true,
      optionsSuccessStatus: 204,
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
  } else if (path.startsWith('/api/index.js')) {
    path = path.substring(13);
  } else if (path.startsWith('/api/index')) {
    path = path.substring(10);
  } else if (path.startsWith('/api')) {
    path = path.substring(4);
  }

  if (!path || path === '') path = '/';
  if (!path.startsWith('/')) path = '/' + path;

  return path + query;
}

export default async function handler(req: any, res: any) {
  const reqOrigin = req.headers?.origin || req.headers?.referer || '';
  let origin = '';
  if (reqOrigin) {
    try {
      origin = new URL(reqOrigin).origin;
    } catch {
      origin = String(reqOrigin).trim().replace(/\/$/, '');
    }
  }

  const effectiveOrigin = origin || 'https://edutrack-applicationn-git-main-shafiulla90s-projects.vercel.app';

  res.setHeader('Access-Control-Allow-Origin', effectiveOrigin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, PUT, PATCH, POST, DELETE, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Accept, Authorization, X-Tenant-ID, X-Requested-With, X-Academic-Year-ID'
  );
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  try {
    await bootstrap();
    if (req.url) {
      req.url = normalizeUrl(req.url);
    }
    server(req, res);
  } catch (error: any) {
    console.error('CRITICAL SERVERLESS BOOTSTRAP ERROR:', error);
    res.setHeader('Access-Control-Allow-Origin', effectiveOrigin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        error: 'Serverless Bootstrap Failed',
        message: error?.message || String(error),
      })
    );
  }
}

module.exports = handler;
module.exports.default = handler;
