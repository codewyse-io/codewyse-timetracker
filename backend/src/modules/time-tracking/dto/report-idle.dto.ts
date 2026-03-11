import { IsDateString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ReportIdleDto {
  @ApiProperty({
    example: '2026-03-08T10:30:00.000Z',
    description: 'ISO 8601 start time of idle period',
  })
  @IsDateString()
  @IsNotEmpty()
  startTime: string;

  @ApiProperty({
    example: '2026-03-08T10:35:00.000Z',
    description: 'ISO 8601 end time of idle period',
  })
  @IsDateString()
  @IsNotEmpty()
  endTime: string;
}
