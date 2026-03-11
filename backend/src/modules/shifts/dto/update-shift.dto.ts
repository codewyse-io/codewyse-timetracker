import { PartialType } from '@nestjs/swagger';
import { CreateShiftDto } from './create-shift.dto';
import { IsOptional, IsBoolean } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateShiftDto extends PartialType(CreateShiftDto) {
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
