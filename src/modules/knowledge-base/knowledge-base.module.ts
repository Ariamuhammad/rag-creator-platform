import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { KnowledgeBaseService } from './knowledge-base.service';
import { KnowledgeBaseController } from './knowledge-base.controller';
import { IngestionProcessor } from '../../jobs/ingestion.processor';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'document-ingestion',
    }),
  ],
  controllers: [KnowledgeBaseController],
  providers: [KnowledgeBaseService, IngestionProcessor],
  exports: [KnowledgeBaseService, BullModule],
})
export class KnowledgeBaseModule {}
