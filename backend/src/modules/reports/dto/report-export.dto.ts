import { IsDateString, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum ExportFormat {
  CSV = 'csv',
  PDF = 'pdf',
}

export class ReportExportDto {
  @ApiProperty()
  @IsDateString()
  weekStart: string;

  @ApiProperty({ enum: ExportFormat })
  @IsEnum(ExportFormat)
  format: ExportFormat;
}
