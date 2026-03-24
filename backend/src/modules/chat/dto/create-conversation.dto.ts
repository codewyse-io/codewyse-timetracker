import { IsEnum, IsString, IsArray, IsOptional, ArrayMinSize } from 'class-validator';

export class CreateConversationDto {
  @IsEnum(['direct', 'group'])
  type: 'direct' | 'group';

  @IsOptional()
  @IsString()
  name?: string;

  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  participantIds: string[];
}
