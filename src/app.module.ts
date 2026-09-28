import {
  Module,
  NestModule,
  MiddlewareConsumer,
  RequestMethod,
} from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from './modules/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { CreatorsModule } from './modules/creators/creators.module';
import { KnowledgeBaseModule } from './modules/knowledge-base/knowledge-base.module';
import { RagEngineModule } from './modules/rag-engine/rag-engine.module';
import { BillingCreditsModule } from './modules/billing-credits/billing-credits.module';
import { ChatModule } from './modules/chat/chat.module';
import { GuardrailsMiddleware } from './common/middlewares/guardrails.middleware';

@Module({
  imports: [
    // Redis & BullMQ Root Configuration
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD || undefined,
      },
    }),

    // Core & Domain Modules
    PrismaModule,
    AuthModule,
    CreatorsModule,
    KnowledgeBaseModule,
    RagEngineModule,
    BillingCreditsModule,
    ChatModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply Guardrails (Anti-Prompt Injection & PII Masking) to all Chat/RAG endpoints
    consumer
      .apply(GuardrailsMiddleware)
      .forRoutes(
        { path: 'chat/query', method: RequestMethod.POST },
        { path: 'chat/*path', method: RequestMethod.ALL },
      );
  }
}
