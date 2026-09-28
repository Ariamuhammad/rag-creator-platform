import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateDiscussionDto {
  @ApiProperty({ example: 'clx123abc-lesson-id' })
  @IsString()
  @IsNotEmpty()
  lessonId: string;

  @ApiProperty({ example: 'Bagaimana cara menentukan nilai parameter efConstruction yang optimal untuk dataset 500k baris?' })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiPropertyOptional({ example: 'clx456parent-discussion-id' })
  @IsString()
  @IsOptional()
  parentId?: string;
}

export class ReplyDiscussionDto {
  @ApiProperty({ example: 'Untuk 500k baris dengan 1536-dim, efConstruction=64 sampai 128 biasanya memberikan recall 95%+ tanpa build time berlebihan.' })
  @IsString()
  @IsNotEmpty()
  content: string;
}
