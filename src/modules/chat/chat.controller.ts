import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { ChatService } from './chat.service';
import { QueryChatDto } from './dto/query-chat.dto';
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
      'Send a query to the Creator RAG Copilot (Enforces Tenant Isolation & Credit Ledger)',
  })
  @ApiResponse({
    status: 200,
    description: 'Answer returned with context sources and token usage ledger.',
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
