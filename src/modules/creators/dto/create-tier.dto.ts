import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTierDto {
  @ApiProperty({ example: 'Pro Copilot Plan' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({
    example: 'Access to all full transcripts and 500,000 token credits/mo',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: 29.99 })
  @IsNumber()
  @IsPositive()
  price: number;

  @ApiProperty({ example: 500000, description: 'Monthly credit quota in tokens' })
  @IsNumber()
  @Min(1000)
  monthlyCreditQuota: number;
}
