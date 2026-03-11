import { IsOptional, IsDateString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class WeeklyPayrollQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    example: '2026-03-02',
    description: 'Start of the week (Monday) in YYYY-MM-DD',
  })
  @IsDateString()
  weekStart: string;
}

export class MonthlyPayrollQueryDto extends PaginationDto {
  @ApiPropertyOptional({ example: 2026 })
  @Type(() => Number)
  @IsInt()
  @Min(2020)
  year: number;

  @ApiPropertyOptional({ example: 3 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month: number;
}

export class PayrollSummaryQueryDto {
  @ApiPropertyOptional({ example: '2026-03-01' })
  @IsDateString()
  startDate: string;

  @ApiPropertyOptional({ example: '2026-03-31' })
  @IsDateString()
  endDate: string;
}

export class EmployeePayrollQueryDto {
  @ApiPropertyOptional({ example: '2026-03-01' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ example: '2026-03-31' })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
