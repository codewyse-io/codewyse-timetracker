import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class PeerReviewAnswerDto {
  @IsString()
  @MaxLength(64)
  questionKey: string;

  @IsInt()
  @Min(1)
  @Max(5)
  score: number;
}

export class SubmitPeerReviewResponseDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PeerReviewAnswerDto)
  answers: PeerReviewAnswerDto[];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;
}
