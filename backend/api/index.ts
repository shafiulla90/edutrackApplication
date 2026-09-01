import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
const express = require('express');
import { ExpressAdapter } from '@nestjs/platform-express';

let appModuleRef: any;
try {
  appModuleRef = require('../dist/src/app.module').AppModule;
} catch (e1) {
  try {
    appModuleRef = require('../src/app.module').AppModule;
  } catch (e2) {
    appModuleRef = require('./src/app.module').AppModule;
  }
}

const server = express();
let cachedApp: any;

async function bootstrap() {
  if (!cachedApp) {
    const app = await NestFactory.create(appModuleRef, new ExpressAdapter(server), {
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
  // Set CORS headers on all responses (including preflight OPTIONS)
  const origin = req.headers?.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, PUT, PATCH, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization, X-Tenant-ID, X-Requested-With');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

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
