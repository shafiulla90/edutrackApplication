"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = handler;
require("reflect-metadata");
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const express = require("express");
const platform_express_1 = require("@nestjs/platform-express");
const app_module_1 = require("../src/app.module");

const server = express();
let cachedApp;

async function bootstrap() {
    if (!cachedApp) {
        const app = await core_1.NestFactory.create(app_module_1.AppModule, new platform_express_1.ExpressAdapter(server), {
            logger: ['error', 'warn', 'log'],
        });

        // Allow ALL origins dynamically - required for Vercel serverless + browser CORS
        app.enableCors({
            origin: (origin, callback) => callback(null, true),
            methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Accept', 'Authorization', 'X-Tenant-ID', 'X-Requested-With'],
            credentials: true,
            optionsSuccessStatus: 204,
        });

        app.useGlobalPipes(new common_1.ValidationPipe({ whitelist: true, transform: true }));
        await app.init();
        cachedApp = app;
    }
    return cachedApp;
}

function normalizeUrl(url) {
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

async function handler(req, res) {
    // Always set CORS headers on EVERY response — before any processing
    const origin = (req.headers && req.headers.origin) ? req.headers.origin : '*';
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, PUT, PATCH, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization, X-Tenant-ID, X-Requested-With');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Max-Age', '86400');

    // Handle OPTIONS preflight immediately - never let it reach NestJS
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
    } catch (error) {
        console.error('CRITICAL SERVERLESS BOOTSTRAP ERROR:', error);
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
            error: 'Serverless Bootstrap Failed',
            message: (error && error.message) ? error.message : String(error),
        }));
    }
}

module.exports = handler;
module.exports.default = handler;