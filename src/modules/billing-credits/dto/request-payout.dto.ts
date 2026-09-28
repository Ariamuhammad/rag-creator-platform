import { IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RequestPayoutDto {
  @ApiProperty({
    description: 'Withdrawal amount in IDR (minimum Rp 50,000)',
    example: 250000,
  })
  @IsNumber()
  @Min(50000, { message: 'Minimum payout withdrawal is Rp 50,000' })
  @IsNotEmpty()
  amount: number;

  @ApiProperty({
    description: 'Optional note or reference for the payout request',
    required: false,
    example: 'Penarikan hasil langganan batch September',
  })
  @IsString()
  @IsOptional()
  notes?: string;
}
