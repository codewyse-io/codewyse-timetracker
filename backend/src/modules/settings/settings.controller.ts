import {
  Controller,
  Get,
  Patch,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

class UpdateSettingsDto {
  settings: { key: string; value: string }[];
}

@ApiTags('Settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @Roles('admin')
  @ApiOperation({ summary: 'Get all settings (admin)' })
  async getAll() {
    return this.settingsService.getAll();
  }

  @Patch()
  @Roles('admin')
  @ApiOperation({ summary: 'Update settings (admin)' })
  async update(@Body() dto: UpdateSettingsDto) {
    const results: any[] = [];
    for (const { key, value } of dto.settings) {
      const setting = await this.settingsService.set(key, value);
      results.push(setting);
    }
    return results;
  }
}
