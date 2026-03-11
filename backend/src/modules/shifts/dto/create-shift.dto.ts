import {
  IsString,
  IsNotEmpty,
  IsArray,
  ArrayMinSize,
  Matches,
  IsIn,
  IsOptional,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const VALID_DAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

export class CreateShiftDto {
  @ApiProperty({ example: 'Morning Shift' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: '09:00', description: 'HH:mm format' })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'startTime must be in HH:mm format',
  })
  startTime: string;

  @ApiProperty({ example: '17:00', description: 'HH:mm format' })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'endTime must be in HH:mm format',
  })
  endTime: string;

  @ApiProperty({
    example: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
    description: 'Array of allowed day names (lowercase)',
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsIn(VALID_DAYS, { each: true })
  allowedDays: string[];

  @ApiPropertyOptional({
    example: 'America/New_York',
    description: 'IANA timezone identifier (defaults to UTC)',
  })
  @IsOptional()
  @IsString()
  timezone?: string;
}
