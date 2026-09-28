import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { DocumentStatus } from '../../common/types/enums';

export interface IngestionJobPayload {
  documentId: string;
  creatorProfileId: string;
  fileBufferBase64: string;
  fileName: string;
  fileType: string;
}

export interface UploadedDocFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
}

@Injectable()
export class KnowledgeBaseService {
  private readonly logger = new Logger(KnowledgeBaseService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('document-ingestion') private readonly ingestionQueue: Queue,
  ) {}

  async uploadAndQueue(
    creatorProfileId: string,
    dto: UploadDocumentDto,
    file: UploadedDocFile,
  ) {
    if (!creatorProfileId) {
      throw new ForbiddenException(
        'User is not associated with any CreatorProfile.',
      );
    }

    // Determine or create default KnowledgeBase for this creator
    let kbId = dto.knowledgeBaseId;
    if (!kbId) {
      let defaultKb = await this.prisma.knowledgeBase.findFirst({
        where: { creatorProfileId, name: 'Default Knowledge Base' },
      });
      if (!defaultKb) {
        defaultKb = await this.prisma.knowledgeBase.create({
          data: {
            creatorProfileId,
            name: 'Default Knowledge Base',
            description: 'Default knowledge base repository for RAG documents.',
          },
        });
      }
      kbId = defaultKb.id;
    }

    // Determine fileType
    const ext = file.originalname.split('.').pop()?.toUpperCase() || 'TXT';
    const fileType = dto.fileType || ext;

    // Create Document in PENDING status
    const doc = await this.prisma.document.create({
      data: {
        knowledgeBaseId: kbId,
        creatorProfileId,
        courseId: dto.courseId || null,
        title: dto.title || file.originalname,
        fileType,
        fileSize: file.size,
        status: DocumentStatus.PENDING,
      },
    });

    // Enqueue background ingestion job
    const jobPayload: IngestionJobPayload = {
      documentId: doc.id,
      creatorProfileId,
      fileBufferBase64: file.buffer.toString('base64'),
      fileName: file.originalname,
      fileType,
    };

    const job = await this.ingestionQueue.add('process-document', jobPayload, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      removeOnComplete: true,
      removeOnFail: false,
    });

    this.logger.log(
      `Enqueued document ingestion job ${job.id} for document ${doc.id} (Creator: ${creatorProfileId}, Course: ${dto.courseId || 'GLOBAL'})`,
    );

    return {
      message: 'Document uploaded successfully and queued for ingestion.',
      document: doc,
      jobId: job.id,
    };
  }

  async getDocumentsByCreator(creatorProfileId: string, courseId?: string) {
    const where: any = { creatorProfileId };
    if (courseId) {
      where.courseId = courseId;
    }

    const docs = await this.prisma.document.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        course: {
          select: { id: true, title: true, slug: true },
        },
        chunks: true,
      },
    });

    return docs.map((doc: any) => ({
      ...doc,
      chunkCount: doc.chunks ? doc.chunks.length : (doc.chunkCount ?? 0),
    }));
  }

  async assignDocumentToCourse(
    creatorProfileId: string,
    documentId: string,
    courseId: string | null,
  ) {
    const doc = await this.prisma.document.findUnique({
      where: { id: documentId },
    });

    if (!doc || doc.creatorProfileId !== creatorProfileId) {
      throw new NotFoundException('Document not found or access denied.');
    }

    if (courseId) {
      const course = await this.prisma.course.findUnique({
        where: { id: courseId },
      });
      if (!course || course.creatorProfileId !== creatorProfileId) {
        throw new ForbiddenException('Invalid course or course access denied.');
      }
    }

    const updated = await this.prisma.document.update({
      where: { id: documentId },
      data: { courseId: courseId || null },
    });

    this.logger.log(
      `Assigned document ${documentId} to course ${courseId || 'GLOBAL'} by creator ${creatorProfileId}`,
    );
    return updated;
  }

  async batchAssignDocuments(
    creatorProfileId: string,
    courseId: string,
    documentIds: string[],
  ) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
    });
    if (!course || course.creatorProfileId !== creatorProfileId) {
      throw new ForbiddenException('Course not found or access denied.');
    }

    for (const docId of documentIds || []) {
      const doc = await this.prisma.document.findUnique({
        where: { id: docId },
      });
      if (doc && doc.creatorProfileId === creatorProfileId) {
        await this.prisma.document.update({
          where: { id: docId },
          data: { courseId },
        });
      }
    }

    this.logger.log(
      `Batch assigned ${documentIds.length} document(s) to course "${course.title}" (${courseId})`,
    );

    return {
      message: `Berhasil menugaskan ${documentIds.length} dokumen RAG ke kursus "${course.title}".`,
      courseId,
      assignedCount: documentIds.length,
    };
  }

  async getDocumentStatus(documentId: string, creatorProfileId: string) {
    const doc = await this.prisma.document.findUnique({
      where: { id: documentId },
      include: {
        course: {
          select: { id: true, title: true, slug: true },
        },
      },
    });

    if (!doc || doc.creatorProfileId !== creatorProfileId) {
      throw new NotFoundException('Document not found or access denied.');
    }

    return doc;
  }

  async deleteDocument(documentId: string, creatorProfileId: string) {
    const doc = await this.prisma.document.findUnique({
      where: { id: documentId },
    });

    if (!doc || doc.creatorProfileId !== creatorProfileId) {
      throw new NotFoundException('Document not found or access denied.');
    }

    await this.prisma.document.delete({
      where: { id: documentId },
    });

    return { message: 'Document and its vector chunks deleted successfully.' };
  }
}
