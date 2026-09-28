import { IsNotEmpty, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateInvoiceDto {
  @ApiProperty({ description: 'Creator Profile ID' })
  @IsUUID()
  @IsNotEmpty()
  creatorProfileId: string;

  @ApiProperty({ description: 'Subscription Tier ID' })
  @IsUUID()
  @IsNotEmpty()
  tierId: string;
}
