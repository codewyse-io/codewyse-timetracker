import {
  Controller,
  Get,
  Param,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { Response } from 'express';
import { ReportsService } from './reports.service';
import { ReportQueryDto } from './dto/report-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentOrg } from '../../common/decorators/current-org.decorator';

@ApiTags('Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('weekly')
  @ApiOperation({ summary: 'Get weekly reports (admin sees all, employee sees own)' })
  async getWeeklyReports(
    @Query() query: ReportQueryDto,
    @Req() req: any,
    @CurrentOrg() orgId: string,
  ) {
    // If not admin, force userId to own
    if (req.user.role !== 'admin') {
      query.userId = req.user.id;
    }
    return this.reportsService.getWeeklyReports(query, orgId);
  }

  @Get('weekly/export/csv')
  @Roles('admin')
  @ApiOperation({ summary: 'Export weekly reports as CSV (admin)' })
  @ApiQuery({ name: 'weekStart', required: true })
  async exportCsv(
    @Query('weekStart') weekStart: string,
    @Res() res: Response,
    @CurrentOrg() orgId: string,
  ) {
    const csv = await this.reportsService.exportCsv(weekStart, orgId);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=report-${weekStart}.csv`);
    res.send(csv);
  }

  @Get('weekly/export/pdf')
  @Roles('admin')
  @ApiOperation({ summary: 'Export weekly reports as PDF (admin)' })
  @ApiQuery({ name: 'weekStart', required: true })
  async exportPdf(
    @Query('weekStart') weekStart: string,
    @Res() res: Response,
    @CurrentOrg() orgId: string,
  ) {
    const pdf = await this.reportsService.exportPdf(weekStart, orgId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=report-${weekStart}.pdf`);
    res.send(pdf);
  }

  @Get('weekly/:id')
  @ApiOperation({ summary: 'Get a single weekly report' })
  async getReportById(@Param('id') id: string) {
    return this.reportsService.getReportById(id);
  }
}
