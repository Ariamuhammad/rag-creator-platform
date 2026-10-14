import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { BROWSER_EMBEDDING_DIMENSIONS } from '../../../common/browser-ai';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class QueryChatDto {
  @ApiProperty({
    description: 'Target Creator Profile ID for tenant isolation',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  @IsNotEmpty()
  creatorProfileId: string;

  @ApiProperty({
    description: 'User question for the RAG Copilot',
    example:
      'Bagaimana cara mengimplementasikan arsitektur microservices yang benar?',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(8000)
  message: string;

  @ApiPropertyOptional({
    description:
      'Existing Chat Session ID, or null to start a new conversation',
  })
  @IsUUID()
  @IsOptional()
  sessionId?: string;

  @ApiPropertyOptional({
    description: 'Target Course ID to enforce course-scoped RAG isolation',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString()
  @IsOptional()
  courseId?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(BROWSER_EMBEDDING_DIMENSIONS)
  @ArrayMaxSize(BROWSER_EMBEDDING_DIMENSIONS)
  @IsNumber({ allowNaN: false, allowInfinity: false }, { each: true })
  @Min(-1, { each: true })
  @Max(1, { each: true })
  embedding?: number[];
}

export class PreparedChatDto {
  @IsUUID()
  requestMessageId: string;
}

export class CompleteChatDto extends PreparedChatDto {
  @IsOptional()
  @IsIn(['generated', 'sources'])
  mode?: 'generated' | 'sources';

  @ValidateIf((dto) => dto.mode !== 'sources')
  @IsString()
  @IsNotEmpty()
  @MaxLength(16000)
  answer?: string;
}
