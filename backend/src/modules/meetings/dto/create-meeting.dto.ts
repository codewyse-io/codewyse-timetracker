import { IsString, IsNotEmpty, IsUrl, IsOptional, IsDateString } from 'class-validator';

export class CreateMeetingDto {
  @IsString() @IsNotEmpty()
  title: string;

  @IsUrl() @IsNotEmpty()
  meetingUrl: string;

  @IsOptional() @IsDateString()
  scheduledStart?: string;

  @IsOptional() @IsDateString()
  scheduledEnd?: string;
}
