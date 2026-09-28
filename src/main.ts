import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Global prefix for API versioning
  app.setGlobalPrefix('api/v1');

  // Enable CORS
  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type, Accept, Authorization, x-tenant-id',
  });

  // Global Validation Pipe with automatic DTO transformation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // OpenAPI / Swagger Documentation Setup
  const config = new DocumentBuilder()
    .setTitle('RAG-as-a-Service for Creators & Educators API')
    .setDescription(
      'Enterprise Multi-Tenant RAG Backend Platform allowing Creators to monetize private knowledge bases with Token Credit Ledger, BullMQ ingestion, and pgvector isolation.',
    )
    .setVersion('1.0.0')
    .addBearerAuth()
    .addTag('Authentication', 'User registration, login, and JWT tokens')
    .addTag('Creators', 'Creator profile, tier management, and analytics')
    .addTag('Knowledge Base', 'Asynchronous document upload, status, and management')
    .addTag('Chat Copilot (RAG)', 'Multi-tenant grounded RAG queries and session history')
    .addTag('Billing & Token Credits', 'Subscription purchases, credit ledger, and quotas')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);

  logger.log(`=======================================================`);
  logger.log(`🚀 Server running on: http://localhost:${port}/api/v1`);
  logger.log(`📚 Swagger Documentation: http://localhost:${port}/api/docs`);
  logger.log(`=======================================================`);
}

bootstrap();
