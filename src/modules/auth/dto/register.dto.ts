import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '../../../common/types/enums';

export class RegisterDto {
  @ApiProperty({ example: 'student@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'SecurePassword123!', minLength: 6 })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiPropertyOptional({ example: 'Budi Santoso' })
  @IsString()
  @IsOptional()
  fullName?: string;

  @ApiProperty({ enum: UserRole, default: UserRole.STUDENT })
  @IsEnum(UserRole)
  role: UserRole;

  // Optional creator specific fields if role is CREATOR
  @ApiPropertyOptional({ example: 'budi-ai' })
  @IsString()
  @IsOptional()
  slug?: string;

  @ApiPropertyOptional({ example: 'Budi AI Mastery' })
  @IsString()
  @IsOptional()
  displayName?: string;
}
