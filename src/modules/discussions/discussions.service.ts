import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDiscussionDto, ReplyDiscussionDto } from './dto/discussion.dto';

@Injectable()
export class DiscussionsService {
  private readonly logger = new Logger(DiscussionsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createDiscussion(userId: string, dto: CreateDiscussionDto) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: dto.lessonId },
    });
    if (!lesson) {
      throw new NotFoundException('Lesson not found.');
    }

    if (dto.parentId) {
      const parent = await this.prisma.lessonDiscussion.findUnique({
        where: { id: dto.parentId },
      });
      if (!parent) {
        throw new NotFoundException('Parent discussion not found.');
      }
    }

    const discussion = await this.prisma.lessonDiscussion.create({
      data: {
        lessonId: dto.lessonId,
        userId,
        content: dto.content,
        parentId: dto.parentId || null,
      },
    });

    this.logger.log(`User ${userId} posted discussion on lesson ${dto.lessonId}`);
    return discussion;
  }

  async getDiscussionsByLesson(lessonId: string) {
    // Fetch all discussions for this lesson ordered by createdAt ASC
    const discussions = await this.prisma.lessonDiscussion.findMany({
      where: { lessonId },
      include: {
        user: {
          select: { id: true, fullName: true, role: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Structure into threads: root discussions with nested replies
    const threadMap = new Map<string, any>();
    const roots: any[] = [];

    for (const d of discussions || []) {
      threadMap.set(d.id, {
        ...d,
        replies: [],
      });
    }

    for (const d of discussions || []) {
      const item = threadMap.get(d.id);
      if (d.parentId && threadMap.has(d.parentId)) {
        threadMap.get(d.parentId).replies.push(item);
      } else {
        roots.push(item);
      }
    }

    return roots;
  }

  async replyDiscussion(userId: string, parentId: string, dto: ReplyDiscussionDto) {
    const parent = await this.prisma.lessonDiscussion.findUnique({
      where: { id: parentId },
    });
    if (!parent) {
      throw new NotFoundException('Discussion thread not found.');
    }

    return this.prisma.lessonDiscussion.create({
      data: {
        lessonId: parent.lessonId,
        userId,
        content: dto.content,
        parentId,
      },
    });
  }

  async deleteDiscussion(userId: string, discussionId: string) {
    const discussion = await this.prisma.lessonDiscussion.findUnique({
      where: { id: discussionId },
    });
    if (!discussion) {
      throw new NotFoundException('Discussion not found.');
    }

    if (discussion.userId !== userId) {
      throw new ForbiddenException('You can only delete your own discussion posts.');
    }

    return this.prisma.lessonDiscussion.delete({
      where: { id: discussionId },
    });
  }
}
