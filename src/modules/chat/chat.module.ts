import { Module } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { RagEngineModule } from '../rag-engine/rag-engine.module';
import { BillingCreditsModule } from '../billing-credits/billing-credits.module';

@Module({
  imports: [RagEngineModule, BillingCreditsModule],
  controllers: [ChatController],
  providers: [ChatService],
  exports: [ChatService],
})
export class ChatModule {}
