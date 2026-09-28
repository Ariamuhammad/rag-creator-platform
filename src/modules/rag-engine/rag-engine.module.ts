import { Module } from '@nestjs/common';
import { RagEngineService } from './rag-engine.service';

@Module({
  providers: [RagEngineService],
  exports: [RagEngineService],
})
export class RagEngineModule {}
