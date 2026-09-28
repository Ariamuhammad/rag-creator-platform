import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RagEngineService } from '../rag-engine/rag-engine.service';
import { BillingCreditsService } from '../billing-credits/billing-credits.service';
import { QueryChatDto } from './dto/query-chat.dto';
import { MessageSender } from '../../common/types/enums';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ragEngine: RagEngineService,
    private readonly billingService: BillingCreditsService,
  ) {}

  async handleChatQuery(studentId: string, dto: QueryChatDto) {
    const { creatorProfileId, message, sessionId } = dto;

    // 1. Verify credit availability before calling RAG
    await this.billingService.validateCreditAvailability(
      studentId,
      creatorProfileId,
      50, // Minimum credit check
    );

    // 2. Fetch Creator Profile to ground the prompt persona
    const creator = await this.prisma.creatorProfile.findUnique({
      where: { id: creatorProfileId },
    });

    if (!creator) {
      throw new NotFoundException('Creator profile not found.');
    }

    // 3. Resolve or Create Chat Session
    let activeSessionId = sessionId;
    if (activeSessionId) {
      const existingSession = await this.prisma.chatSession.findUnique({
        where: { id: activeSessionId },
      });
      if (
        !existingSession ||
        existingSession.studentId !== studentId ||
        existingSession.creatorProfileId !== creatorProfileId
      ) {
        throw new ForbiddenException('Invalid session ID or session access denied.');
      }
    } else {
      const newSession = await this.prisma.chatSession.create({
        data: {
          studentId,
          creatorProfileId,
          title: message.slice(0, 50) + (message.length > 50 ? '...' : ''),
        },
      });
      activeSessionId = newSession.id;
    }

    // 4. Save User message in database
    await this.prisma.chatMessage.create({
      data: {
        chatSessionId: activeSessionId,
        sender: MessageSender.USER,
        content: message,
      },
    });

    // 5. Execute Multi-Tenant RAG retrieval and generation
    const ragResult = await this.ragEngine.executeRagQuery(
      creatorProfileId,
      message,
      creator.displayName,
    );

    // 6. Save Assistant response in database with token metrics and source contexts
    const assistantMessage = await this.prisma.chatMessage.create({
      data: {
        chatSessionId: activeSessionId,
        sender: MessageSender.ASSISTANT,
        content: ragResult.answer,
        promptTokens: ragResult.usage.promptTokens,
        completionTokens: ragResult.usage.completionTokens,
        retrievedContext: ragResult.sources as any,
      },
    });

    // 7. Deduct token credits and log to CreditLedger
    const deductionResult = await this.billingService.deductTokens(
      studentId,
      creatorProfileId,
      activeSessionId,
      ragResult.usage.promptTokens,
      ragResult.usage.completionTokens,
    );

    return {
      sessionId: activeSessionId,
      messageId: assistantMessage.id,
      answer: ragResult.answer,
      sources: ragResult.sources,
      usage: ragResult.usage,
      credits: {
        deducted: deductionResult.creditsDeducted,
        remainingCredits: deductionResult.remainingCredits,
      },
    };
  }

  async getSessions(studentId: string, creatorProfileId: string) {
    return this.prisma.chatSession.findMany({
      where: {
        studentId,
        creatorProfileId,
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getSessionMessages(sessionId: string, studentId: string) {
    const session = await this.prisma.chatSession.findUnique({
      where: { id: sessionId },
    });

    if (!session || session.studentId !== studentId) {
      throw new ForbiddenException('Chat session not found or access denied.');
    }

    return this.prisma.chatMessage.findMany({
      where: { chatSessionId: sessionId },
      orderBy: { createdAt: 'asc' },
    });
  }
}
