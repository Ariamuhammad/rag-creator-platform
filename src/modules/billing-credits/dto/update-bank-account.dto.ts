import { IsNotEmpty, IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateBankAccountDto {
  @ApiProperty({
    description: 'Bank name or e-wallet name (e.g. BCA, MANDIRI, BRI, BNI, OVO, DANA)',
    example: 'BCA',
  })
  @IsString()
  @IsNotEmpty()
  bankName: string;

  @ApiProperty({
    description: 'Bank account number or e-wallet account number',
    example: '1234567890',
  })
  @IsString()
  @IsNotEmpty()
  @Length(5, 30)
  bankAccountNumber: string;

  @ApiProperty({
    description: 'Bank account holder full name',
    example: 'Budi Santoso',
  })
  @IsString()
  @IsNotEmpty()
  @Length(2, 100)
  bankAccountHolderName: string;
}
