import { IsOptional, IsString, IsIn } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class StartSessionDto {
  @ApiPropertyOptional({ description: 'Session mode: regular or overtime', enum: ['regular', 'overtime'] })
  @IsOptional()
  @IsIn(['regular', 'overtime'])
  mode?: 'regular' | 'overtime';

  @ApiPropertyOptional({ description: 'Optional notes for the session' })
  @IsOptional()
  @IsString()
  notes?: string;
}
