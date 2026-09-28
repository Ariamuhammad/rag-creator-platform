import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { NotesService } from './notes.service';
import { CreateNoteDto, UpdateNoteDto } from './dto/note.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Student Notes')
@Controller('notes')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class NotesController {
  constructor(private readonly notesService: NotesService) {}

  @Post()
  @ApiOperation({ summary: 'Save selected highlight / personal learning note' })
  async createNote(
    @CurrentUser('id') studentId: string,
    @Body() dto: CreateNoteDto,
  ) {
    return this.notesService.createNote(studentId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all notes for authenticated student, optionally filtered by lesson' })
  async getNotes(
    @CurrentUser('id') studentId: string,
    @Query('lessonId') lessonId?: string,
  ) {
    return this.notesService.getNotes(studentId, lessonId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update personal learning note' })
  async updateNote(
    @CurrentUser('id') studentId: string,
    @Param('id') noteId: string,
    @Body() dto: UpdateNoteDto,
  ) {
    return this.notesService.updateNote(studentId, noteId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete personal learning note' })
  async deleteNote(
    @CurrentUser('id') studentId: string,
    @Param('id') noteId: string,
  ) {
    return this.notesService.deleteNote(studentId, noteId);
  }
}
