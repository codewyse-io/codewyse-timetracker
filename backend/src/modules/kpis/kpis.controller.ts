import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { KpisService } from './kpis.service';
import { CreateKpiEntryDto } from './dto/create-kpi-entry.dto';
import { BulkKpiEntryDto } from './dto/bulk-kpi-entry.dto';
import { KpiPeriod } from './entities/kpi-entry.entity';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentOrg } from '../../common/decorators/current-org.decorator';

@ApiTags('KPIs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('kpis')
export class KpisController {
  constructor(private readonly kpisService: KpisService) {}

  @Get('definitions')
  @ApiOperation({ summary: 'Get KPI definitions by designation' })
  @ApiQuery({ name: 'designation', required: false })
  async getDefinitions(
    @CurrentOrg() orgId: string,
    @Query('designation') designation?: string,
  ) {
    return this.kpisService.getDefinitions(orgId, designation);
  }

  @Post('entry')
  @Roles('admin')
  @ApiOperation({ summary: 'Create a KPI entry (admin)' })
  async createEntry(@Body() dto: CreateKpiEntryDto, @CurrentOrg() orgId: string) {
    return this.kpisService.createEntry(dto, orgId);
  }

  @Post('entries/bulk')
  @Roles('admin')
  @ApiOperation({ summary: 'Bulk create KPI entries (admin)' })
  async bulkCreateEntries(@Body() dto: BulkKpiEntryDto, @CurrentOrg() orgId: string) {
    return this.kpisService.bulkCreateEntries(dto.entries, orgId);
  }

  @Get('employee/:id')
  @Roles('admin')
  @ApiOperation({ summary: 'Get KPIs for a specific employee (admin)' })
  @ApiQuery({ name: 'period', enum: KpiPeriod, required: false })
  @ApiQuery({ name: 'periodStart', required: false })
  async getEmployeeKpis(
    @Param('id') id: string,
    @Query('period') period?: KpiPeriod,
    @Query('periodStart') periodStart?: string,
  ) {
    return this.kpisService.getEmployeeKpis(id, period, periodStart);
  }

  @Get('team')
  @Roles('admin')
  @ApiOperation({ summary: 'Get team KPIs (admin)' })
  @ApiQuery({ name: 'period', enum: KpiPeriod, required: true })
  @ApiQuery({ name: 'periodStart', required: true })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async getTeamKpis(
    @CurrentOrg() orgId: string,
    @Query('period') period: KpiPeriod,
    @Query('periodStart') periodStart: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    return this.kpisService.getTeamKpis(orgId, period, periodStart, +page, +limit);
  }
}
