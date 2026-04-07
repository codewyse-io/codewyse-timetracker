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
import { CurrentOrg } from '../../common/decorators/current-org.decorator';

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
  async getAll(@CurrentOrg() orgId: string) {
    return this.settingsService.getAll(orgId);
  }

  @Patch()
  @Roles('admin')
  @ApiOperation({ summary: 'Update settings (admin)' })
  async update(@Body() dto: UpdateSettingsDto, @CurrentOrg() orgId: string) {
    const results: any[] = [];
    for (const { key, value } of dto.settings) {
      const setting = await this.settingsService.set(key, value, undefined, orgId);
      results.push(setting);
    }
    return results;
  }
}
