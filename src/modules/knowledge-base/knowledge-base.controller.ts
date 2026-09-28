import {
  Controller,
  Post,
  Get,
  Delete,
  Patch,
  Query,
  Param,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiConsumes,
  ApiBearerAuth,
  ApiResponse,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import { KnowledgeBaseService } from './knowledge-base.service';
import type { UploadedDocFile } from './knowledge-base.service';
import {
  UploadDocumentDto,
  AssignCourseDto,
  BatchAssignDocumentsDto,
} from './dto/upload-document.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '../../common/types/enums';

@ApiTags('Knowledge Base')
@Controller('knowledge-base')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class KnowledgeBaseController {
  constructor(private readonly kbService: KnowledgeBaseService) {}

  @Post('upload')
  @Roles(UserRole.CREATOR, UserRole.ADMIN)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload PDF/CSV document for asynchronous ingestion' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        title: { type: 'string', example: 'Advanced Machine Learning Course' },
        knowledgeBaseId: { type: 'string', format: 'uuid' },
        fileType: { type: 'string', example: 'PDF' },
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  async uploadDocument(
    @CurrentUser('creatorProfileId') creatorProfileId: string,
    @Body() dto: UploadDocumentDto,
    @UploadedFile() file: UploadedDocFile,
  ) {
    if (!file) {
      throw new BadRequestException('A document file is required.');
    }
    return this.kbService.uploadAndQueue(creatorProfileId, dto, file);
  }

  @Get('documents')
  @Roles(UserRole.CREATOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'List all uploaded documents for current creator, optionally filtered by courseId' })
  @ApiQuery({ name: 'courseId', required: false, description: 'Filter documents assigned to a specific course' })
  async getDocuments(
    @CurrentUser('creatorProfileId') creatorProfileId: string,
    @Query('courseId') courseId?: string,
  ) {
    return this.kbService.getDocumentsByCreator(creatorProfileId, courseId);
  }

  @Patch('documents/:id/assign-course')
  @Roles(UserRole.CREATOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Assign or reassign document to a specific course (or null for global)' })
  async assignDocument(
    @CurrentUser('creatorProfileId') creatorProfileId: string,
    @Param('id') documentId: string,
    @Body() dto: AssignCourseDto,
  ) {
    return this.kbService.assignDocumentToCourse(creatorProfileId, documentId, dto.courseId ?? null);
  }

  @Post('courses/:courseId/assign-documents')
  @Roles(UserRole.CREATOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Batch assign multiple documents to a specific course' })
  async batchAssign(
    @CurrentUser('creatorProfileId') creatorProfileId: string,
    @Param('courseId') courseId: string,
    @Body() dto: BatchAssignDocumentsDto,
  ) {
    return this.kbService.batchAssignDocuments(creatorProfileId, courseId, dto.documentIds);
  }

  @Get('documents/:id/status')
  @Roles(UserRole.CREATOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Check asynchronous ingestion status of a document' })
  async getStatus(
    @Param('id') documentId: string,
    @CurrentUser('creatorProfileId') creatorProfileId: string,
  ) {
    return this.kbService.getDocumentStatus(documentId, creatorProfileId);
  }

  @Delete('documents/:id')
  @Roles(UserRole.CREATOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete document and all associated vector chunks' })
  async deleteDocument(
    @Param('id') documentId: string,
    @CurrentUser('creatorProfileId') creatorProfileId: string,
  ) {
    return this.kbService.deleteDocument(documentId, creatorProfileId);
  }
}
