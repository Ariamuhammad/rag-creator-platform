import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UploadDocumentDto {
  @ApiProperty({ example: 'Advanced System Design Guide.pdf' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({
    description: 'Existing KnowledgeBase ID, or auto-assigned to default',
  })
  @IsUUID()
  @IsOptional()
  knowledgeBaseId?: string;

  @ApiPropertyOptional({ description: 'Document type: PDF, CSV, or TXT' })
  @IsString()
  @IsOptional()
  fileType?: string;

  @ApiPropertyOptional({ description: 'Optional Course ID to assign document exclusively to a course' })
  @IsString()
  @IsOptional()
  courseId?: string;
}

export class AssignCourseDto {
  @ApiPropertyOptional({ description: 'Target Course ID, or null to make global' })
  @IsOptional()
  courseId?: string | null;
}

export class BatchAssignDocumentsDto {
  @ApiProperty({ description: 'Array of document IDs to assign to this course', example: ['doc-id-1', 'doc-id-2'] })
  @IsNotEmpty()
  documentIds: string[];
}
