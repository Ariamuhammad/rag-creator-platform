import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateNoteDto, UpdateNoteDto } from './dto/note.dto';

@Injectable()
export class NotesService {
  private readonly logger = new Logger(NotesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createNote(studentId: string, dto: CreateNoteDto) {
    const note = await this.prisma.studentNote.create({
      data: {
        studentId,
        lessonId: dto.lessonId,
        selectedText: dto.selectedText || null,
        noteText: dto.noteText,
      },
    });

    this.logger.log(`Student ${studentId} saved note for lesson ${dto.lessonId}`);
    return note;
  }

  async getNotes(studentId: string, lessonId?: string) {
    const where: any = { studentId };
    if (lessonId) {
      where.lessonId = lessonId;
    }

    return this.prisma.studentNote.findMany({
      where,
      include: {
        lesson: {
          select: { id: true, title: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateNote(studentId: string, noteId: string, dto: UpdateNoteDto) {
    const note = await this.prisma.studentNote.findUnique({
      where: { id: noteId },
    });

    if (!note) {
      throw new NotFoundException('Note not found.');
    }

    if (note.studentId !== studentId) {
      throw new ForbiddenException('You can only edit your own notes.');
    }

    return this.prisma.studentNote.update({
      where: { id: noteId },
      data: {
        noteText: dto.noteText,
      },
    });
  }

  async deleteNote(studentId: string, noteId: string) {
    const note = await this.prisma.studentNote.findUnique({
      where: { id: noteId },
    });

    if (!note) {
      throw new NotFoundException('Note not found.');
    }

    if (note.studentId !== studentId) {
      throw new ForbiddenException('You can only delete your own notes.');
    }

    return this.prisma.studentNote.delete({
      where: { id: noteId },
    });
  }
}
