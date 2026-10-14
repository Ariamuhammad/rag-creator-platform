import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { ChatService } from './chat.service';
import {
  CompleteChatDto,
  PreparedChatDto,
  QueryChatDto,
} from './dto/query-chat.dto';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantAccessGuard } from '../../common/guards/tenant-access.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Chat Copilot (RAG)')
@Controller('chat')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('query')
  @UseGuards(TenantAccessGuard)
  @ApiOperation({
    summary:
      'Prepare browser RAG context, or generate an answer when server inference is explicitly enabled',
  })
  @ApiResponse({
    status: 200,
    description:
      'Browser mode returns messages and requestMessageId for /chat/complete; server mode returns the generated answer.',
  })
  @ApiResponse({
    status: 403,
    description: 'Insufficient credits or missing active subscription.',
  })
  async queryChat(
    @CurrentUser('id') studentId: string,
    @Body() dto: QueryChatDto,
  ) {
    return this.chatService.handleChatQuery(studentId, dto);
  }

  @Post('complete')
  @ApiOperation({
    summary: 'Save a browser-generated answer for an authorized prepared query',
  })
  complete(@CurrentUser('id') studentId: string, @Body() dto: CompleteChatDto) {
    return this.chatService.completeBrowserQuery(studentId, dto);
  }

  @Post('server-fallback')
  async fallback(
    @CurrentUser('id') studentId: string,
    @Body() dto: PreparedChatDto,
    @Req() req: Request,
  ) {
    const controller = new AbortController();
    const cancel = () => {
      if (!req.res?.writableEnded) controller.abort();
    };
    req.res?.on('close', cancel);
    try {
      return await this.chatService.fallbackBrowserQuery(
        studentId,
        dto.requestMessageId,
        controller.signal,
      );
    } finally {
      req.res?.off('close', cancel);
    }
  }

  @Get('sessions/:creatorProfileId')
  @UseGuards(TenantAccessGuard)
  @ApiOperation({ summary: 'Get all chat sessions for a specific Creator' })
  async getSessions(
    @CurrentUser('id') studentId: string,
    @Param('creatorProfileId') creatorProfileId: string,
  ) {
    return this.chatService.getSessions(studentId, creatorProfileId);
  }

  @Get('sessions/:sessionId/messages')
  @ApiOperation({ summary: 'Get all messages inside a specific chat session' })
  async getSessionMessages(
    @CurrentUser('id') studentId: string,
    @Param('sessionId') sessionId: string,
  ) {
    return this.chatService.getSessionMessages(sessionId, studentId);
  }
}
