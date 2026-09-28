import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCourseDto {
  @ApiProperty({ example: 'Enterprise Multi-Tenant RAG & Vector Systems' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: 'enterprise-rag-systems' })
  @IsString()
  @IsNotEmpty()
  slug: string;

  @ApiPropertyOptional({ example: 'Panduan arsitektur sistem RAG dengan pgvector dan BullMQ.' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ example: 'https://example.com/thumb.jpg' })
  @IsString()
  @IsOptional()
  thumbnailUrl?: string;

  @ApiPropertyOptional({ example: 'ADVANCED', default: 'INTERMEDIATE' })
  @IsString()
  @IsOptional()
  level?: string;
}

export class CreateModuleDto {
  @ApiProperty({ example: 'Bab 3: Vector Indexing & pgvector Optimization' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({ example: 'Eksplorasi mendalam indeks graf HNSW vs IVFFlat' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ example: 3, default: 0 })
  @IsOptional()
  orderIndex?: number;
}

export class CreateLessonDto {
  @ApiProperty({ example: '3.2 Arsitektur Indexing: HNSW vs IVFFlat pada PostgreSQL' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({ example: 'reading', default: 'reading' })
  @IsString()
  @IsOptional()
  type?: string;

  @ApiPropertyOptional({ example: '28 min' })
  @IsString()
  @IsOptional()
  duration?: string;

  @ApiPropertyOptional({ example: '# Konten materi lengkap markdown...' })
  @IsString()
  @IsOptional()
  contentMarkdown?: string;

  @ApiPropertyOptional({ example: 'https://youtube.com/watch?v=...' })
  @IsString()
  @IsOptional()
  videoUrl?: string;

  @ApiPropertyOptional({ example: 2, default: 0 })
  @IsOptional()
  orderIndex?: number;
}

export class UpdateProgressDto {
  @ApiProperty({ example: true })
  @IsNotEmpty()
  completed: boolean;
}

export class CreateFullCourseDto {
  @ApiProperty({ example: 'Enterprise Multi-Tenant RAG & Vector Systems' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: 'enterprise-rag-systems' })
  @IsString()
  @IsNotEmpty()
  slug: string;

  @ApiPropertyOptional({ example: 'Panduan arsitektur sistem RAG dengan pgvector dan BullMQ.' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ example: 'https://example.com/thumb.jpg' })
  @IsString()
  @IsOptional()
  thumbnailUrl?: string;

  @ApiPropertyOptional({ example: 'ADVANCED', default: 'INTERMEDIATE' })
  @IsString()
  @IsOptional()
  level?: string;

  @ApiPropertyOptional({ description: 'Array of Document IDs to assign to this course', example: ['doc-1', 'doc-2'] })
  @IsOptional()
  documentIds?: string[];

  @ApiPropertyOptional({
    description: 'Array of modules with nested lessons',
  })
  @IsOptional()
  modules?: {
    id?: string;
    title: string;
    description?: string;
    orderIndex?: number;
    lessons?: {
      id?: string;
      title: string;
      type?: string;
      duration?: string;
      contentMarkdown?: string;
      videoUrl?: string;
      orderIndex?: number;
    }[];
  }[];
}
