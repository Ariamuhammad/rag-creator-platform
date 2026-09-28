import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
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
    example: 'Bagaimana cara mengimplementasikan arsitektur microservices yang benar?',
  })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiPropertyOptional({
    description: 'Existing Chat Session ID, or null to start a new conversation',
  })
  @IsUUID()
  @IsOptional()
  sessionId?: string;
}
