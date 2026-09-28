import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateCourseDto,
  CreateModuleDto,
  CreateLessonDto,
  CreateFullCourseDto,
} from './dto/course.dto';
import { SubscriptionStatus } from '../../common/types/enums';

@Injectable()
export class CoursesService {
  private readonly logger = new Logger(CoursesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creator creates a full course with modules, lessons, and assigned RAG documents in one go!
   */
  async createFullCourse(userId: string, dto: CreateFullCourseDto) {
    const creator = await this.prisma.creatorProfile.findUnique({
      where: { userId },
    });
    if (!creator) {
      throw new ForbiddenException('Only registered creators can create courses.');
    }

    const normalizedSlug = dto.slug.toLowerCase().trim();
    const existingCourse = await this.prisma.course.findUnique({
      where: { slug: normalizedSlug },
    });

    let course: any;
    if (existingCourse) {
      if (existingCourse.creatorProfileId !== creator.id) {
        throw new ForbiddenException('Slug kursus ini sudah digunakan oleh edukator lain.');
      }
      // Update existing course metadata
      course = await this.prisma.course.update({
        where: { id: existingCourse.id },
        data: {
          title: dto.title,
          description: dto.description || null,
          thumbnailUrl: dto.thumbnailUrl || null,
          level: dto.level || 'INTERMEDIATE',
        },
      });
    } else {
      // Create new course
      course = await this.prisma.course.create({
        data: {
          creatorProfileId: creator.id,
          title: dto.title,
          slug: normalizedSlug,
          description: dto.description || null,
          thumbnailUrl: dto.thumbnailUrl || null,
          level: dto.level || 'INTERMEDIATE',
          isPublished: true,
        },
      });
    }

    // 1. Assign selected RAG documents to this course (and unassign deselected)
    if (dto.documentIds) {
      const currentlyAssigned = await this.prisma.document.findMany({
        where: { courseId: course.id, creatorProfileId: creator.id },
      });
      for (const curDoc of currentlyAssigned) {
        if (!dto.documentIds.includes(curDoc.id)) {
          await this.prisma.document.update({
            where: { id: curDoc.id },
            data: { courseId: null },
          });
        }
      }

      for (const docId of dto.documentIds) {
        const doc = await this.prisma.document.findUnique({ where: { id: docId } });
        if (doc && doc.creatorProfileId === creator.id) {
          await this.prisma.document.update({
            where: { id: docId },
            data: { courseId: course.id },
          });
        }
      }
    }

    // 2. Create or update modules and nested lessons
    const createdModules: any[] = [];
    if (dto.modules && dto.modules.length > 0) {
      const currentModules = existingCourse
        ? await this.prisma.courseModule.findMany({
            where: { courseId: course.id },
            include: { lessons: true },
          })
        : [];

      const submittedModuleIds = dto.modules.map((m: any) => m.id).filter(Boolean);

      // Remove deleted modules if updating
      if (existingCourse && currentModules.length > 0) {
        for (const currMod of currentModules) {
          if (!submittedModuleIds.includes(currMod.id)) {
            await this.prisma.lesson.deleteMany({ where: { courseModuleId: currMod.id } });
            await this.prisma.courseModule.delete({ where: { id: currMod.id } });
          }
        }
      }

      for (let mIdx = 0; mIdx < dto.modules.length; mIdx++) {
        const m: any = dto.modules[mIdx];
        let moduleRecord: any;

        if (m.id && currentModules.some((cm) => cm.id === m.id)) {
          moduleRecord = await this.prisma.courseModule.update({
            where: { id: m.id },
            data: {
              title: m.title,
              description: m.description || null,
              orderIndex: m.orderIndex ?? mIdx + 1,
            },
          });
        } else {
          moduleRecord = await this.prisma.courseModule.create({
            data: {
              courseId: course.id,
              title: m.title,
              description: m.description || null,
              orderIndex: m.orderIndex ?? mIdx + 1,
            },
          });
        }

        const createdLessons: any[] = [];
        if (m.lessons && m.lessons.length > 0) {
          const currentLessons = (currentModules.find((cm) => cm.id === moduleRecord.id)?.lessons) || [];
          const submittedLessonIds = m.lessons.map((l: any) => l.id).filter(Boolean);

          for (const currLes of currentLessons) {
            if (!submittedLessonIds.includes(currLes.id)) {
              await this.prisma.lesson.delete({ where: { id: currLes.id } }).catch(() => null);
            }
          }

          for (let lIdx = 0; lIdx < m.lessons.length; lIdx++) {
            const l: any = m.lessons[lIdx];
            let lessonRecord: any;

            const durationStr = l.duration
              ? (l.duration.includes('min') ? l.duration : `${l.duration.trim()} min`)
              : '15 min';

            if (l.id && currentLessons.some((cl) => cl.id === l.id)) {
              lessonRecord = await this.prisma.lesson.update({
                where: { id: l.id },
                data: {
                  title: l.title,
                  type: l.type || 'reading',
                  duration: durationStr,
                  contentMarkdown: l.contentMarkdown || null,
                  videoUrl: l.videoUrl || null,
                  orderIndex: l.orderIndex ?? lIdx + 1,
                },
              });
            } else {
              lessonRecord = await this.prisma.lesson.create({
                data: {
                  courseModuleId: moduleRecord.id,
                  title: l.title,
                  type: l.type || 'reading',
                  duration: durationStr,
                  contentMarkdown: l.contentMarkdown || null,
                  videoUrl: l.videoUrl || null,
                  orderIndex: l.orderIndex ?? lIdx + 1,
                },
              });
            }
            createdLessons.push(lessonRecord);
          }
        }

        createdModules.push({
          ...moduleRecord,
          lessons: createdLessons,
        });
      }
    }

    this.logger.log(
      `Creator ${creator.displayName} saved FULL course: ${course.title} (${course.slug}) with ${createdModules.length} module(s).`,
    );

    return {
      ...course,
      modules: createdModules,
      assignedDocumentCount: dto.documentIds?.length || 0,
    };
  }

  /**
   * Creator creates a new course.
   */
  async createCourse(userId: string, dto: CreateCourseDto) {
    const creator = await this.prisma.creatorProfile.findUnique({
      where: { userId },
    });
    if (!creator) {
      throw new ForbiddenException('Only registered creators can create courses.');
    }

    const course = await this.prisma.course.create({
      data: {
        creatorProfileId: creator.id,
        title: dto.title,
        slug: dto.slug.toLowerCase().trim(),
        description: dto.description || null,
        thumbnailUrl: dto.thumbnailUrl || null,
        level: dto.level || 'INTERMEDIATE',
        isPublished: true,
      },
    });

    this.logger.log(`Creator ${creator.displayName} created course: ${course.title} (${course.id})`);
    return course;
  }

  /**
   * List all published courses with creator details.
   */
  async listPublishedCourses() {
    return this.prisma.course.findMany({
      where: { isPublished: true },
      include: {
        creatorProfile: {
          select: { displayName: true, slug: true, bio: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Creator gets all their own courses with full modules, lessons, and assigned RAG documents.
   */
  async getMyCourses(userId: string) {
    const creator = await this.prisma.creatorProfile.findUnique({
      where: { userId },
    });
    if (!creator) return [];

    const courses = await this.prisma.course.findMany({
      where: { creatorProfileId: creator.id },
      orderBy: { createdAt: 'desc' },
    });

    const detailedCourses = await Promise.all(
      (courses || []).map(async (course: any) => {
        const modules = await this.prisma.courseModule.findMany({
          where: { courseId: course.id },
          orderBy: { orderIndex: 'asc' },
        });

        const formattedModules = await Promise.all(
          (modules || []).map(async (mod: any) => {
            const lessons = await this.prisma.lesson.findMany({
              where: { courseModuleId: mod.id },
              orderBy: { orderIndex: 'asc' },
            });
            return {
              ...mod,
              lessons: lessons || [],
            };
          }),
        );

        const documents = await this.prisma.document.findMany({
          where: { courseId: course.id },
          select: {
            id: true,
            title: true,
            fileType: true,
            fileSize: true,
            createdAt: true,
            chunkCount: true,
            status: true,
          },
        });

        return {
          ...course,
          modules: formattedModules,
          documents: documents || [],
        };
      }),
    );

    return detailedCourses;
  }

  /**
   * Get course by slug with full syllabus (modules and lessons).
   */
  async getCourseBySlug(slug: string, studentId?: string) {
    const course = await this.prisma.course.findUnique({
      where: { slug },
      include: {
        creatorProfile: true,
      },
    });

    if (!course) {
      throw new NotFoundException(`Course not found for slug: ${slug}`);
    }

    const modules = await this.prisma.courseModule.findMany({
      where: { courseId: course.id },
      orderBy: { orderIndex: 'asc' },
    });

    // Attach student progress if student is authenticated
    let progressMap: Record<string, boolean> = {};
    if (studentId) {
      const progressList = await this.prisma.lessonProgress.findMany({
        where: { studentId },
      });
      progressMap = (progressList || []).reduce((acc: any, curr: any) => {
        acc[curr.lessonId] = curr.completed;
        return acc;
      }, {});
    }

    const formattedModules = await Promise.all(
      (modules || []).map(async (mod: any) => {
        const lessons = await this.prisma.lesson.findMany({
          where: { courseModuleId: mod.id },
          orderBy: { orderIndex: 'asc' },
        });
        return {
          ...mod,
          lessons: (lessons || []).map((les: any) => ({
            ...les,
            completed: !!progressMap[les.id],
          })),
        };
      }),
    );

    const documents = await this.prisma.document.findMany({
      where: {
        creatorProfileId: course.creatorProfileId,
        courseId: course.id,
      },
      select: {
        id: true,
        title: true,
        fileType: true,
        fileSize: true,
        createdAt: true,
      },
    });

    return {
      ...course,
      modules: formattedModules,
      documents: documents || [],
    };
  }

  /**
   * Creator adds a module / chapter to their course.
   */
  async createModule(userId: string, courseId: string, dto: CreateModuleDto) {
    const creator = await this.prisma.creatorProfile.findUnique({
      where: { userId },
    });
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
    });

    if (!course || course.creatorProfileId !== creator?.id) {
      throw new ForbiddenException('You do not have permission to manage modules for this course.');
    }

    return this.prisma.courseModule.create({
      data: {
        courseId,
        title: dto.title,
        description: dto.description || null,
        orderIndex: dto.orderIndex ?? 0,
      },
    });
  }

  /**
   * Creator adds a lesson to a module.
   */
  async createLesson(userId: string, courseModuleId: string, dto: CreateLessonDto) {
    const creator = await this.prisma.creatorProfile.findUnique({
      where: { userId },
    });
    const courseModule = await this.prisma.courseModule.findUnique({
      where: { id: courseModuleId },
      include: { course: true },
    });

    if (!courseModule || courseModule.course?.creatorProfileId !== creator?.id) {
      throw new ForbiddenException('You do not have permission to add lessons to this module.');
    }

    return this.prisma.lesson.create({
      data: {
        courseModuleId,
        title: dto.title,
        type: dto.type || 'reading',
        duration: dto.duration || null,
        contentMarkdown: dto.contentMarkdown || null,
        videoUrl: dto.videoUrl || null,
        orderIndex: dto.orderIndex ?? 0,
      },
    });
  }

  /**
   * Student marks lesson complete or uncompletes.
   */
  async updateLessonProgress(studentId: string, lessonId: string, completed: boolean) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
    });
    if (!lesson) {
      throw new NotFoundException('Lesson not found.');
    }

    const existing = await this.prisma.lessonProgress.findFirst({
      where: { studentId, lessonId },
    });

    if (existing) {
      return this.prisma.lessonProgress.update({
        where: { id: existing.id },
        data: {
          completed,
          completedAt: completed ? new Date() : null,
        },
      });
    }

    return this.prisma.lessonProgress.create({
      data: {
        studentId,
        lessonId,
        completed,
        completedAt: completed ? new Date() : null,
      },
    });
  }

  /**
   * Master Silabus / Enrolled Courses for Student:
   * Returns all courses where student has active subscription or progress,
   * with progress bar percentage, active tier name, and remaining token credits.
   */
  async getEnrolledCourses(studentId: string) {
    // 1. Fetch student's active subscriptions to creators
    const subscriptions = await this.prisma.subscription.findMany({
      where: {
        studentId,
        status: SubscriptionStatus.ACTIVE,
      },
      include: {
        tier: true,
        creatorProfile: true,
      },
    });

    const enrolledList = [];

    for (const sub of subscriptions || []) {
      // Find courses by this creator
      const courses = await this.prisma.course.findMany({
        where: { creatorProfileId: sub.creatorProfileId },
      });

      for (const course of courses || []) {
        const modules = await this.prisma.courseModule.findMany({
          where: { courseId: course.id },
        });

        const allLessons: any[] = [];
        for (const mod of modules || []) {
          const lessons = await this.prisma.lesson.findMany({
            where: { courseModuleId: mod.id },
          });
          allLessons.push(...(lessons || []));
        }

        const totalLessons = allLessons.length;

        // Count completed lessons for this student
        const completedProgress = await this.prisma.lessonProgress.findMany({
          where: {
            studentId,
            completed: true,
          },
        });

        const completedLessonIds = new Set((completedProgress || []).map((p: any) => p.lessonId));
        const completedCount = allLessons.filter((l: any) => completedLessonIds.has(l.id)).length;
        const progressPercentage = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;

        enrolledList.push({
          courseId: course.id,
          courseTitle: course.title,
          slug: course.slug,
          description: course.description,
          thumbnailUrl: course.thumbnailUrl,
          level: course.level,
          creator: {
            id: sub.creatorProfile.id,
            displayName: sub.creatorProfile.displayName,
            slug: sub.creatorProfile.slug,
          },
          subscription: {
            tierName: sub.tier?.name || 'Active Tier',
            remainingCredits: sub.remainingCredits,
            expiresAt: sub.currentPeriodEnd,
          },
          curriculumProgress: {
            completedCount,
            totalLessons,
            percentage: progressPercentage,
          },
        });
      }
    }

    return enrolledList;
  }
}
