import { Controller, Get } from '@nestjs/common';
import { AiService } from './ai.service';
import { BROWSER_EMBEDDING_SPACE } from '../../common/browser-ai';

@Controller('ai')
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Get('config')
  config() {
    return {
      execution: this.ai.browser ? 'browser' : 'server',
      embeddingSpace: BROWSER_EMBEDDING_SPACE,
    };
  }
}
