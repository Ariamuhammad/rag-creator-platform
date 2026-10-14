import { AiModule } from '../ai/ai.module';
import { Module } from '@nestjs/common';
import { RagEngineService } from './rag-engine.service';

@Module({
  imports: [AiModule],
  providers: [RagEngineService],
  exports: [RagEngineService],
})
export class RagEngineModule {}
