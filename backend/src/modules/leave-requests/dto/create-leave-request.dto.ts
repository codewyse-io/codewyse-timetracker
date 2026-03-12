import { IsDateString, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateLeaveRequestDto {
  @ApiProperty({ example: 'Sick Leave' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  subject: string;

  @ApiProperty({ example: 'I am feeling unwell and need to rest.' })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiProperty({ example: '2026-03-15' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ example: '2026-03-16' })
  @IsDateString()
  endDate: string;
}
