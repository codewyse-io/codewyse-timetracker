import { IsEnum, IsString, IsOptional, IsNumber } from 'class-validator';

export class SendMessageDto {
  @IsEnum(['text', 'file'])
  type: 'text' | 'file';

  @IsString()
  content: string;

  @IsOptional()
  @IsString()
  replyToId?: string;

  // File fields (required when type = 'file')
  @IsOptional()
  @IsString()
  fileUrl?: string;

  @IsOptional()
  @IsString()
  fileName?: string;

  @IsOptional()
  @IsNumber()
  fileSize?: number;

  @IsOptional()
  @IsString()
  mimeType?: string;
}
