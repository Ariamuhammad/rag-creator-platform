import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTierDto } from './dto/create-tier.dto';
import { UpdateCreatorDto } from './dto/update-creator.dto';

@Injectable()
export class CreatorsService {
  constructor(private readonly prisma: PrismaService) {}

  async getCreatorBySlug(slug: string) {
    const creator = await this.prisma.creatorProfile.findUnique({
      where: { slug: slug.toLowerCase() },
      include: {
        subscriptionTiers: {
          where: { isActive: true },
          orderBy: { price: 'asc' },
        },
        _count: {
          select: {
            documents: true,
            subscriptions: true,
          },
        },
      },
    });

    if (!creator) {
      throw new NotFoundException(`Creator with slug '${slug}' not found.`);
    }

    return creator;
  }

  async getCreatorById(id: string) {
    const creator = await this.prisma.creatorProfile.findUnique({
      where: { id },
      include: {
        subscriptionTiers: {
          where: { isActive: true },
        },
      },
    });

    if (!creator) {
      throw new NotFoundException(`Creator with ID '${id}' not found.`);
    }

    return creator;
  }

  async updateProfile(creatorProfileId: string, dto: UpdateCreatorDto) {
    return this.prisma.creatorProfile.update({
      where: { id: creatorProfileId },
      data: {
        ...dto,
      },
    });
  }

  async createTier(creatorProfileId: string, dto: CreateTierDto) {
    return this.prisma.subscriptionTier.create({
      data: {
        creatorProfileId,
        name: dto.name,
        description: dto.description,
        price: dto.price,
        monthlyCreditQuota: dto.monthlyCreditQuota,
      },
    });
  }

  async getTiers(creatorProfileId: string) {
    return this.prisma.subscriptionTier.findMany({
      where: { creatorProfileId, isActive: true },
      orderBy: { price: 'asc' },
    });
  }

  async getAnalytics(creatorProfileId: string) {
    const totalSubscribers = await this.prisma.subscription.count({
      where: { creatorProfileId, status: 'ACTIVE' },
    });

    const totalDocuments = await this.prisma.document.count({
      where: { creatorProfileId, status: 'COMPLETED' },
    });

    const totalQueries = await this.prisma.creditLedger.count({
      where: { creatorProfileId, eventType: 'CHAT_QUERY' },
    });

    return {
      totalActiveSubscribers: totalSubscribers,
      totalKnowledgeDocuments: totalDocuments,
      totalQueriesHandled: totalQueries,
    };
  }

  async getStudentActivityAnalytics(creatorProfileId: string) {
    // 1. Get courses created by this creator
    const courses: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT id, title, slug, level FROM courses WHERE "creatorProfileId" = $1 ORDER BY "createdAt" DESC`,
      creatorProfileId,
    );

    // 2. Total lessons per course
    const lessonStats: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT c.id as "courseId", COUNT(l.id)::int as "totalLessons"
       FROM courses c
       LEFT JOIN course_modules cm ON cm."courseId" = c.id
       LEFT JOIN lessons l ON l."courseModuleId" = cm.id
       WHERE c."creatorProfileId" = $1
       GROUP BY c.id`,
      creatorProfileId,
    );
    const totalLessonsMap = new Map(lessonStats.map((s) => [s.courseId, s.totalLessons]));

    // 3. Subscribed students
    const students: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT 
        s.id as "subscriptionId",
        s."studentId",
        u."fullName",
        u.email,
        st.name as "tierName",
        s."remainingCredits",
        s.status as "subscriptionStatus",
        s."createdAt" as "enrolledAt"
      FROM subscriptions s
      JOIN users u ON u.id = s."studentId"
      JOIN subscription_tiers st ON st.id = s."tierId"
      WHERE s."creatorProfileId" = $1
      ORDER BY s."createdAt" DESC`,
      creatorProfileId,
    );

    // 4. Student progress in each course
    const studentProgressList: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT 
        lp."studentId",
        c.id as "courseId",
        COUNT(lp.id)::int as "completedCount",
        MAX(lp."completedAt") as "lastActiveAt"
      FROM lesson_progress lp
      JOIN lessons l ON l.id = lp."lessonId"
      JOIN course_modules cm ON cm.id = l."courseModuleId"
      JOIN courses c ON c.id = cm."courseId"
      WHERE c."creatorProfileId" = $1 AND lp.completed = true
      GROUP BY lp."studentId", c.id`,
      creatorProfileId,
    );

    // Build student roster
    const studentRoster = students.map((st) => {
      const studentCourses = courses.map((c) => {
        const prog = studentProgressList.find(
          (p) => p.studentId === st.studentId && p.courseId === c.id,
        );
        const completed = prog?.completedCount || 0;
        const total = totalLessonsMap.get(c.id) || 0;
        const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
        return {
          courseId: c.id,
          courseTitle: c.title,
          slug: c.slug,
          completedCount: completed,
          totalLessons: total,
          percentage,
          lastActiveAt: prog?.lastActiveAt || null,
        };
      });

      const avgProgress =
        studentCourses.length > 0
          ? Math.round(
              studentCourses.reduce((acc, c) => acc + c.percentage, 0) /
                studentCourses.length,
            )
          : 0;

      return {
        studentId: st.studentId,
        fullName: st.fullName,
        email: st.email,
        tierName: st.tierName,
        remainingCredits: st.remainingCredits,
        subscriptionStatus: st.subscriptionStatus,
        enrolledAt: st.enrolledAt,
        courses: studentCourses,
        overallProgress: avgProgress,
      };
    });

    // 5. Recent completed lessons
    const recentCompletions: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT 
        lp.id,
        u."fullName" as "studentName",
        u.email as "studentEmail",
        l.title as "lessonTitle",
        c.title as "courseTitle",
        lp."completedAt" as "timestamp",
        'LESSON_COMPLETED' as "activityType"
      FROM lesson_progress lp
      JOIN users u ON u.id = lp."studentId"
      JOIN lessons l ON l.id = lp."lessonId"
      JOIN course_modules cm ON cm.id = l."courseModuleId"
      JOIN courses c ON c.id = cm."courseId"
      WHERE c."creatorProfileId" = $1 AND lp.completed = true
      ORDER BY lp."completedAt" DESC
      LIMIT 8`,
      creatorProfileId,
    );

    // 6. Recent AI Copilot queries
    const recentAiQueries: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT 
        cm.id,
        u."fullName" as "studentName",
        u.email as "studentEmail",
        cm.content as "question",
        COALESCE(cm."promptTokens", 0) + COALESCE(cm."completionTokens", 0) as "totalTokens",
        cm."createdAt" as "timestamp",
        'AI_QUERY' as "activityType"
      FROM chat_messages cm
      JOIN chat_sessions cs ON cs.id = cm."chatSessionId"
      JOIN users u ON u.id = cs."studentId"
      WHERE cs."creatorProfileId" = $1 AND cm.sender = 'USER'
      ORDER BY cm."createdAt" DESC
      LIMIT 8`,
      creatorProfileId,
    );

    // 7. Recent Discussions
    const recentDiscussions: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT 
        ld.id,
        u."fullName" as "authorName",
        l.title as "lessonTitle",
        c.title as "courseTitle",
        ld.content,
        ld."createdAt" as "timestamp",
        'DISCUSSION' as "activityType"
      FROM lesson_discussions ld
      JOIN users u ON u.id = ld."userId"
      JOIN lessons l ON l.id = ld."lessonId"
      JOIN course_modules cm ON cm.id = l."courseModuleId"
      JOIN courses c ON c.id = cm."courseId"
      WHERE c."creatorProfileId" = $1
      ORDER BY ld."createdAt" DESC
      LIMIT 8`,
      creatorProfileId,
    );

    // 8. Overview KPIs
    const totalStudents = students.length;
    const totalCompletedLessons = studentProgressList.reduce(
      (acc, p) => acc + p.completedCount,
      0,
    );
    const totalTokensRow: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT COALESCE(SUM("totalTokens"), 0)::int as "totalTokens"
       FROM credit_ledgers
       WHERE "creatorProfileId" = $1 AND "eventType" = 'CHAT_QUERY'`,
      creatorProfileId,
    );

    const avgCompletion =
      studentRoster.length > 0
        ? Math.round(
            studentRoster.reduce((acc, s) => acc + s.overallProgress, 0) /
              studentRoster.length,
          )
        : 0;

    return {
      kpis: {
        totalStudents,
        totalCompletedLessons,
        totalTokensConsumed: totalTokensRow[0]?.totalTokens || 0,
        averageCompletionRate: avgCompletion,
        totalCourses: courses.length,
      },
      students: studentRoster,
      recentCompletions,
      recentAiQueries,
      recentDiscussions,
      courses,
    };
  }
}
