import { IsUUID, IsNumber, IsEnum, IsDateString, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { KpiPeriod } from '../entities/kpi-entry.entity';

export class CreateKpiEntryDto {
  @ApiProperty()
  @IsUUID()
  userId: string;

  @ApiProperty()
  @IsUUID()
  kpiDefinitionId: string;

  @ApiProperty()
  @IsNumber()
  value: number;

  @ApiProperty({ enum: KpiPeriod })
  @IsEnum(KpiPeriod)
  period: KpiPeriod;

  @ApiProperty()
  @IsDateString()
  periodStart: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
