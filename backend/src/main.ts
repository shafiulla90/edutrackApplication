import * as fs from 'fs';
import * as path from 'path';

// Parse .env manually
try {
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const envLines = fs.readFileSync(envPath, 'utf8').split('\n');
    envLines.forEach((line) => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*"(.*)"\s*$/) || line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
      if (match) {
        const key = match[1];
        const value = match[2];
        if (!process.env[key]) {
          process.env[key] = value.trim();
        }
      }
    });
  }
} catch (e) {}

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: any) => void) => {
      if (origin) {
        callback(null, origin);
      } else {
        callback(null, true);
      }
    },
    credentials: true,
  });

  // global pipes
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // Swagger setup
  const config = new DocumentBuilder()
    .setTitle('EduTrack SaaS API')
    .setDescription('The school management system API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  await app.listen(process.env.PORT || 3000);
}
bootstrap();
