import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
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
import * as pdfParse from 'pdf-parse';

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

  /**
   * Generates a structured course syllabus with modules, lessons, and markdown content from an uploaded PDF.
   */
  async generateSyllabusFromPdf(
    fileBuffer: Buffer,
    originalName: string,
    instructions?: string,
    targetLevel?: string,
  ) {
    this.logger.log(`Generating course syllabus from PDF: ${originalName} (${fileBuffer.length} bytes)`);

    // 1. Extract text using pdf-parse
    let rawText = '';
    try {
      const parsePdf: any =
        typeof pdfParse === 'function'
          ? pdfParse
          : (pdfParse as any)?.default || pdfParse;
      const pdfData = await parsePdf(fileBuffer);
      rawText = pdfData?.text || '';
    } catch (parseErr: any) {
      this.logger.error(`Error parsing PDF ${originalName}: ${parseErr.message}`);
      throw new BadRequestException('Gagal mengekstrak teks dari dokumen PDF yang diunggah. Pastikan file PDF valid.');
    }

    if (!rawText.trim()) {
      throw new BadRequestException('Dokumen PDF kosong atau berupa file scan gambar tanpa teks yang dapat dibaca.');
    }

    // 2. Intelligent Multi-Segment Text Sampling (up to 45,000 characters)
    // Avoids sampling only intro pages by taking representative slices across the entire document
    let textSnippet = '';
    const maxChars = 45000;
    if (rawText.length <= maxChars) {
      textSnippet = rawText;
    } else {
      const partLength = Math.floor(maxChars / 3);
      const head = rawText.slice(0, partLength);
      const midStart = Math.floor((rawText.length - partLength) / 2);
      const mid = rawText.slice(midStart, midStart + partLength);
      const tail = rawText.slice(rawText.length - partLength);
      textSnippet = `--- [BAGIAN 1: INTRODUKSI, DEFINISI & FONDASI] ---\n${head}\n\n--- [BAGIAN 2: ARSITEKTUR, ALGORITMA & KOMPONEN INTI] ---\n${mid}\n\n--- [BAGIAN 3: ADVANCED TECHNIQUES, IMPLEMENTASI & EVALUASI] ---\n${tail}`;
    }

    // 3. Call Groq/OpenAI with structured output
    const apiKey = process.env.OPENAI_API_KEY;
    const baseUrl = process.env.OPENAI_BASE_URL || 'https://api.groq.com/openai/v1';
    const model = process.env.LLM_MODEL || 'openai/gpt-oss-120b';

    const systemPrompt = `Anda adalah Principal Systems Architect & Kurator Pendidikan Teknikal Kelas Dunia.
Tugas Anda adalah membaca intisari teks dokumen materi (buku, handbook, kurikulum, panduan, slide, atau modul) yang diunggah edukator, lalu merombaknya menjadi Draf Kurikulum Silabus Kursus Masterclass yang mendalam, profesional, dan BEBAS DARI AI SLOP.

PRINSIP ANTI-AI SLOP (ZERO SLOP MANIFESTO):
1. DILARANG DAFTAR POIN DANGKAL (BULLET-POINT SOUP): Jangan hanya membuat daftar bullet points berisi definisi abstrak atau ringkasan 2 baris. Tulis penjelasan dalam paragraf narasi teknis berbobot tinggi layaknya buku engineering O'Reilly.
2. DILARANG BASA-BASI AI: Jangan pernah menulis pengantar klise ("Pada modul ini kita akan belajar...", "Selamat datang di...") atau penutup klise ("Kesimpulannya...", "Semoga membantu!"). Langsung masuki substansi teknis dengan tajam pada kalimat pertama.
3. KEDALAMAN (DEPTH) LEBIH UTAMA DARIPADA KUANTITAS: Buat 2 hingga 3 Modul terstruktur, dengan masing-masing 2 hingga 3 Lessons berkualitas tinggi. Setiap materi harus padat ilmu, konkret, dan bernilai jual tinggi.
4. KOMPONEN WAJIB DI SETIAP LESSON (contentMarkdown):
   - Diagram Alur / Arsitektur: Minimal 1 representasi visual arsitektur menggunakan ASCII diagram yang rapi di dalam code block teks (\`\`\`text ... \`\`\`) untuk menjelaskan dataflow atau interaksi komponen.
   - Analisis & Deep Dive Teknis: Penjelasan detail mengenai mekanisme internal, trade-offs, kompleksitas, atau benchmark relevan dari materi dokumen.
   - Blok Kode / Konfigurasi Nyata: Minimal 1 blok kode implementasi nyata / production-grade code snippet (Python, TypeScript, SQL/Cypher, atau JSON/YAML konfigurasi) lengkap dengan penamaan variabel realistis dan komentar inline penjelas.
   - Production Gotchas & Best Practices: Gunakan blok peringatan (> [!WARNING] atau > [!NOTE]) yang mengulas failure modes, latency bottlenecks, atau jebakan implementasi di industri nyata.
   - Format Istilah: Format semua istilah teknis penting menggunakan bold (**term**). Jangan gunakan tanda kutip tunggal/ganda pada istilah teknis.

Struktur JSON yang WAJIB dihasilkan:
- title: Judul kursus komprehensif, teknis, dan berwibawa.
- slug: Kebab-case URL slug berdasarkan judul kursus (contoh: mastering-rag-and-graphrag-architecture).
- description: Ringkasan teknis kurikulum dalam 2-3 kalimat tajam.
- level: ${targetLevel && ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'].includes(targetLevel) ? `"${targetLevel}"` : 'Tentukan "BEGINNER", "INTERMEDIATE", atau "ADVANCED" berdasarkan bobot materi'}.
- modules: Array 2-3 modul berbobot.
  - title: Judul modul profesional (contoh: "Modul 1: Fondasi Vektor & Triad RAG").
  - description: Deskripsi kapabilitas teknis yang dipelajari murid di modul ini.
  - lessons: Array 2-3 materi per modul.
    - title: Judul materi spesifik & terstruktur (contoh: "1.1 Arsitektur Dense Retrieval & Vector Similarity").
    - type: "reading" | "video" | "hybrid" (berikan variasi natural reading & hybrid).
    - duration: "15 min" | "20 min" | "25 min".
    - videoPlacement: "TOP" (default).
    - videoUrl: "" (kosongkan jika belum ada video).
    - contentMarkdown: Konten materi masterclass lengkap dengan format markdown yang kaya sesuai 4 Komponen Wajib di atas.

${instructions ? `Instruksi khusus dari Edukator:\n${instructions}\n` : ''}

Format output HARUS selalu berupa JSON murni valid tanpa teks markdown backtick di luar JSON:
{
  "title": "...",
  "slug": "...",
  "description": "...",
  "level": "INTERMEDIATE",
  "modules": [
    {
      "title": "Modul 1: ...",
      "description": "...",
      "lessons": [
        {
          "title": "1.1 ...",
          "type": "reading",
          "duration": "20 min",
          "videoPlacement": "TOP",
          "videoUrl": "",
          "contentMarkdown": "# 1.1 ...\\n\\n..."
        }
      ]
    }
  ]
}`;

    const userPrompt = `Nama Dokumen: ${originalName}
Panjang Teks Dokumen: ${rawText.length} karakter

Intisari Dokumen:
${textSnippet}`;

    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.3,
          max_tokens: 8000,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        this.logger.error(`LLM syllabus generation failed: ${response.status} - ${errorBody}`);
        throw new Error(`LLM Error ${response.status}: ${errorBody}`);
      }

      const json = await response.json();
      const content = json.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error('LLM tidak mengembalikan respons teks.');
      }

      const parsedSyllabus = JSON.parse(content);

      // Sanitize and ensure fallback values
      if (!parsedSyllabus.title) parsedSyllabus.title = originalName.replace(/\.[^/.]+$/, '');
      if (!parsedSyllabus.slug) {
        parsedSyllabus.slug = parsedSyllabus.title
          .toLowerCase()
          .replace(/[^\w\s-]/g, '')
          .replace(/[\s_-]+/g, '-')
          .replace(/^-+|-+$/g, '');
      }
      if (!parsedSyllabus.level) parsedSyllabus.level = targetLevel || 'INTERMEDIATE';
      if (!Array.isArray(parsedSyllabus.modules)) parsedSyllabus.modules = [];

      return {
        success: true,
        sourceFileName: originalName,
        courseDraft: parsedSyllabus,
      };
    } catch (llmErr: any) {
      this.logger.error(`Failed to generate course syllabus: ${llmErr.message}`);
      throw new BadRequestException(`Gagal menghasilkan silabus AI: ${llmErr.message}`);
    }
  }
}
