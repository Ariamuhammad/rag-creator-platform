import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RagEngineService } from '../rag-engine/rag-engine.service';
import { BillingCreditsService } from '../billing-credits/billing-credits.service';
import { QueryChatDto } from './dto/query-chat.dto';
import { MessageSender } from '../../common/types/enums';
import { AiService } from '../ai/ai.service';
import { CompleteChatDto } from './dto/query-chat.dto';
import { randomUUID } from 'crypto';
import { assessAnswer, answerFromSources } from '../../common/grounding';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private readonly fallbackRequests = new Map<string, Promise<any>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly ragEngine: RagEngineService,
    private readonly billingService: BillingCreditsService,
    private readonly ai: AiService,
  ) {}

  async handleChatQuery(studentId: string, dto: QueryChatDto) {
    const { creatorProfileId, message, sessionId } = dto;
    if (
      this.ai.browser &&
      dto.embedding &&
      !dto.embedding.some((value) => value !== 0)
    ) {
      throw new BadRequestException('Embedding pertanyaan tidak valid.');
    }

    // 1. Verify credit availability before calling RAG
    const subscription = await this.billingService.validateCreditAvailability(
      studentId,
      creatorProfileId,
      this.ai.browser ? 0 : 50,
    );

    // 2. Fetch Creator Profile to ground the prompt persona
    const creator = await this.prisma.creatorProfile.findUnique({
      where: { id: creatorProfileId },
    });

    if (!creator) {
      throw new NotFoundException('Creator profile not found.');
    }

    if (dto.courseId) {
      const course = await this.prisma.course.findUnique({
        where: { id: dto.courseId },
      });
      if (!course || course.creatorProfileId !== creatorProfileId) {
        throw new ForbiddenException('Course not found or access denied.');
      }
      if (course.isPublished === false)
        throw new ForbiddenException('Course is still a draft.');
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
        throw new ForbiddenException(
          'Invalid session ID or session access denied.',
        );
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
    const userMessage = await this.prisma.chatMessage.create({
      data: {
        chatSessionId: activeSessionId,
        sender: MessageSender.USER,
        content: message,
      },
    });

    if (this.ai.browser) {
      const embedding = dto.embedding
        ? dto.embedding.concat(new Array(1536 - dto.embedding.length).fill(0))
        : null;
      const context = await this.ragEngine.prepareRagQuery(
        creatorProfileId,
        message,
        creator.displayName,
        dto.courseId,
        embedding,
      );
      if (subscription.remainingCredits < 50 && !context.answer)
        context.answer = answerFromSources(context.sources);
      await this.prisma.chatMessage.update({
        where: { id: userMessage.id },
        data: { retrievedContext: { ...context, completionId: randomUUID() } },
      });
      if (context.answer) {
        return this.completeBrowserQuery(studentId, {
          requestMessageId: userMessage.id,
          answer: context.answer,
        });
      }
      return {
        execution: 'browser',
        sessionId: activeSessionId,
        requestMessageId: userMessage.id,
        messages: context.messages,
        sources: context.sources,
      };
    }

    // 5. Execute Multi-Tenant RAG retrieval and generation (with optional course-scoped isolation)
    const ragResult = await this.ragEngine.executeRagQuery(
      creatorProfileId,
      message,
      creator.displayName,
      dto.courseId,
    );

    // Keep the answer and credit ledger atomic in primary server mode too.
    const { assistantMessage, deductionResult } =
      await this.prisma.$transaction(async (tx) => {
        const assistantMessage = await tx.chatMessage.create({
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
          tx,
        );
        return { assistantMessage, deductionResult };
      });

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

  async fallbackBrowserQuery(
    studentId: string,
    requestMessageId: string,
    signal?: AbortSignal,
  ) {
    const question = await this.prisma.chatMessage.findUnique({
      where: { id: requestMessageId },
    });
    const session =
      question &&
      (await this.prisma.chatSession.findUnique({
        where: { id: question.chatSessionId },
      }));
    const context = question?.retrievedContext as any;
    if (
      !session ||
      session.studentId !== studentId ||
      question.sender !== MessageSender.USER ||
      !context?.completionId ||
      !Array.isArray(context.messages)
    )
      throw new ForbiddenException(
        'Prepared query not found or access denied.',
      );
    const subscription = await this.billingService.validateCreditAvailability(
      studentId,
      session.creatorProfileId,
      0,
    );
    const existing = await this.prisma.chatMessage.findUnique({
      where: { id: context.completionId },
    });
    if (existing || context.answer || subscription.remainingCredits < 50)
      return this.completeBrowserQuery(studentId, {
        requestMessageId,
        mode: 'sources',
      });
    const pending = this.fallbackRequests.get(context.completionId);
    if (pending) return pending;
    const job = (async () => {
      const result = await this.ai.generateFallback(context.messages, signal);
      signal?.throwIfAborted();
      return this.completeBrowserQuery(studentId, {
        requestMessageId,
        answer: result.content,
      });
    })();
    this.fallbackRequests.set(context.completionId, job);
    try {
      return await job;
    } finally {
      this.fallbackRequests.delete(context.completionId);
    }
  }

  async completeBrowserQuery(studentId: string, dto: CompleteChatDto) {
    const question = await this.prisma.chatMessage.findUnique({
      where: { id: dto.requestMessageId },
    });
    const session =
      question &&
      (await this.prisma.chatSession.findUnique({
        where: { id: question.chatSessionId },
      }));
    const context = question?.retrievedContext as any;
    if (
      !session ||
      session.studentId !== studentId ||
      question.sender !== MessageSender.USER ||
      !context?.completionId
    ) {
      throw new ForbiddenException(
        'Prepared query not found or access denied.',
      );
    }
    const subscription = await this.billingService.validateCreditAvailability(
      studentId,
      session.creatorProfileId,
      0,
    );
    const format = (message: any, credits: any) => ({
      sessionId: session.id,
      messageId: message.id,
      answer: message.content,
      sources: context.sources,
      mode:
        message.retrievedContext?.mode ||
        (message.promptTokens === 0 ? 'sources' : 'generated'),
      usage: {
        promptTokens: message.promptTokens,
        completionTokens: message.completionTokens,
        totalTokens: message.promptTokens + message.completionTokens,
      },
      credits,
    });
    const existing = await this.prisma.chatMessage.findUnique({
      where: { id: context.completionId },
    });
    if (existing)
      return format(existing, {
        deducted: 0,
        remainingCredits: subscription.remainingCredits,
      });
    const suppliedAnswer = dto.answer?.trim() || '';
    if (!context.answer && dto.mode !== 'sources' && !suppliedAnswer)
      throw new BadRequestException('Jawaban AI kosong.');
    const assessment = assessAnswer(suppliedAnswer, context.sources);
    const sourcesOnly =
      !!context.answer || dto.mode === 'sources' || !assessment.supported;
    const answer = sourcesOnly
      ? context.answer || answerFromSources(context.sources)
      : suppliedAnswer;
    if (!answer) throw new BadRequestException('Jawaban AI kosong.');
    // Client token counts are untrusted; estimate quota usage from server-stored prompts and answer text.
    const promptTokens = sourcesOnly
      ? 0
      : Math.ceil(
          context.messages.reduce(
            (sum: number, message: any) => sum + message.content.length,
            0,
          ) / 4,
        );
    const completionTokens = sourcesOnly ? 0 : Math.ceil(answer.length / 4);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const assistant = await tx.chatMessage.create({
          data: {
            id: context.completionId,
            chatSessionId: session.id,
            sender: MessageSender.ASSISTANT,
            content: answer,
            promptTokens,
            completionTokens,
            retrievedContext: {
              sources: context.sources,
              mode: sourcesOnly ? 'sources' : 'generated',
              evidence: sourcesOnly ? [] : assessment.claims,
            },
          },
        });
        const deduction = sourcesOnly
          ? {
              creditsDeducted: 0,
              remainingCredits: subscription.remainingCredits,
            }
          : await this.billingService.deductTokens(
              studentId,
              session.creatorProfileId,
              session.id,
              promptTokens,
              completionTokens,
              tx,
            );
        return format(assistant, {
          deducted: deduction.creditsDeducted,
          remainingCredits: deduction.remainingCredits,
        });
      });
    } catch (error) {
      // A repeated completion shares a primary key, so concurrent retries cannot charge twice.
      const completed = await this.prisma.chatMessage.findUnique({
        where: { id: context.completionId },
      });
      if (!completed) throw error;
      return format(completed, {
        deducted: 0,
        remainingCredits: (
          await this.billingService.validateCreditAvailability(
            studentId,
            session.creatorProfileId,
            0,
          )
        ).remainingCredits,
      });
    }
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
