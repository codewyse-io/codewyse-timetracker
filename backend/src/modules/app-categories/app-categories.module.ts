import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppCategoryRule } from './entities/app-category-rule.entity';
import { AppCategoriesService } from './app-categories.service';
import { AppCategoriesController } from './app-categories.controller';

@Module({
  imports: [TypeOrmModule.forFeature([AppCategoryRule])],
  controllers: [AppCategoriesController],
  providers: [AppCategoriesService],
  exports: [AppCategoriesService],
})
export class AppCategoriesModule {}
