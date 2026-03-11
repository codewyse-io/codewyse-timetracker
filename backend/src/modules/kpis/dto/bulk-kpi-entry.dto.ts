import { ValidateNested, IsArray } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { CreateKpiEntryDto } from './create-kpi-entry.dto';

export class BulkKpiEntryDto {
  @ApiProperty({ type: [CreateKpiEntryDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateKpiEntryDto)
  entries: CreateKpiEntryDto[];
}
