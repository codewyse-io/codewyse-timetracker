import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AppCategoriesService } from './app-categories.service';
import { IsString, IsOptional, IsEnum } from 'class-validator';
import { AppCategory } from '../time-tracking/enums/app-category.enum';
import { MatchType } from './entities/app-category-rule.entity';

class CreateAppCategoryRuleDto {
  @IsString()
  appIdentifier: string;

  @IsEnum(MatchType)
  @IsOptional()
  matchType?: MatchType;

  @IsEnum(AppCategory)
  category: AppCategory;

  @IsString()
  @IsOptional()
  displayName?: string;

  @IsString()
  @IsOptional()
  shiftId?: string;

  @IsString()
  @IsOptional()
  designation?: string;
}

@Controller('app-categories')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AppCategoriesController {
  constructor(private readonly service: AppCategoriesService) {}

  @Get()
  async findAll(
    @Query('shiftId') shiftId?: string,
    @Query('designation') designation?: string,
  ) {
    return this.service.findAll(shiftId, designation);
  }

  @Post()
  @Roles('admin')
  async create(@Body() dto: CreateAppCategoryRuleDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  @Roles('admin')
  async update(@Param('id') id: string, @Body() dto: Partial<CreateAppCategoryRuleDto>) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Roles('admin')
  async remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
