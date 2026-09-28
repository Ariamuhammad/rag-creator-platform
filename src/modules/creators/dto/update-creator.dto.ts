import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateCreatorDto {
  @ApiPropertyOptional({ example: 'Dr. Andrew Ng, AI Educator' })
  @IsString()
  @IsOptional()
  displayName?: string;

  @ApiPropertyOptional({ example: 'Official Knowledge Base and Copilot.' })
  @IsString()
  @IsOptional()
  bio?: string;
}
