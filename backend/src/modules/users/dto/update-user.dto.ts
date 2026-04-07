import { OmitType, PartialType } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, ValidateIf } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CreateUserDto } from './create-user.dto';

export class UpdateUserDto extends PartialType(OmitType(CreateUserDto, ['shiftId'] as const)) {
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((o) => o.shiftId !== null)
  @IsUUID()
  shiftId?: string | null;

  @ApiPropertyOptional({ description: 'Organization ID (super_admin only)' })
  @IsOptional()
  @IsString()
  organizationId?: string;
}
