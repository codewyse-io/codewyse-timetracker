import {
  Controller,
  Get,
  Param,
  Query,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PayrollService, PayrollSummary, PayrollEntry } from './payroll.service';
import {
  WeeklyPayrollQueryDto,
  MonthlyPayrollQueryDto,
  PayrollSummaryQueryDto,
  EmployeePayrollQueryDto,
} from './dto/payroll-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentOrg } from '../../common/decorators/current-org.decorator';

@ApiTags('Payroll')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('payroll')
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  @Get('weekly')
  @ApiOperation({ summary: 'Get weekly payroll (admin only)' })
  async getWeeklyPayroll(
    @Query() query: WeeklyPayrollQueryDto,
    @CurrentOrg() orgId: string,
  ): Promise<PayrollSummary> {
    return this.payrollService.getWeeklyPayroll(new Date(query.weekStart), orgId);
  }

  @Get('monthly')
  @ApiOperation({ summary: 'Get monthly payroll (admin only)' })
  async getMonthlyPayroll(
    @Query() query: MonthlyPayrollQueryDto,
    @CurrentOrg() orgId: string,
  ): Promise<PayrollSummary> {
    return this.payrollService.getMonthlyPayroll(query.year, query.month, orgId);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Get payroll summary for a date range (admin only)' })
  async getPayrollSummary(
    @Query() query: PayrollSummaryQueryDto,
    @CurrentOrg() orgId: string,
  ): Promise<PayrollSummary> {
    return this.payrollService.getPayrollSummary(
      new Date(query.startDate),
      new Date(query.endDate),
      orgId,
    );
  }

  @Get('employee/:id')
  @ApiOperation({ summary: 'Get payroll for a specific employee (admin only)' })
  async getEmployeePayroll(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: EmployeePayrollQueryDto,
    @CurrentOrg() orgId: string,
  ): Promise<PayrollEntry> {
    return this.payrollService.getEmployeePayroll(
      id,
      query.startDate ? new Date(query.startDate) : undefined,
      query.endDate ? new Date(query.endDate) : undefined,
      orgId,
    );
  }
}
