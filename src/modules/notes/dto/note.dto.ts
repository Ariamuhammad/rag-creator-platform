import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateNoteDto {
  @ApiProperty({ example: 'clx123abc-lesson-id' })
  @IsString()
  @IsNotEmpty()
  lessonId: string;

  @ApiPropertyOptional({ example: 'Formula HNSW M=16, efConstruction=64' })
  @IsString()
  @IsOptional()
  selectedText?: string;

  @ApiProperty({ example: 'Ingat untuk benchmark latency index saat dataset mencapai 1 juta vektor.' })
  @IsString()
  @IsNotEmpty()
  noteText: string;
}

export class UpdateNoteDto {
  @ApiProperty({ example: 'Revisi catatan: efSearch juga perlu disetel ke 40.' })
  @IsString()
  @IsNotEmpty()
  noteText: string;
}
