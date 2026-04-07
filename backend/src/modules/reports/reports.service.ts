import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { WeeklyReport } from './entities/weekly-report.entity';
import { WorkSession } from '../time-tracking/entities/work-session.entity';
import { DailyFocusScore } from '../focus-score/entities/daily-focus-score.entity';
import { KpiEntry } from '../kpis/entities/kpi-entry.entity';
import { User } from '../users/entities/user.entity';
import { ReportQueryDto } from './dto/report-query.dto';
import { PaginatedResponseDto } from '../../common/dto/paginated-response.dto';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    @InjectRepository(WeeklyReport)
    private readonly reportRepo: Repository<WeeklyReport>,
    @InjectRepository(WorkSession)
    private readonly workSessionRepo: Repository<WorkSession>,
    @InjectRepository(DailyFocusScore)
    private readonly focusScoreRepo: Repository<DailyFocusScore>,
    @InjectRepository(KpiEntry)
    private readonly kpiEntryRepo: Repository<KpiEntry>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async generateWeeklyReport(
    userId: string,
    weekStart: string,
    weekEnd: string,
    organizationId?: string,
  ): Promise<WeeklyReport> {
    // Aggregate work sessions for the week
    const sessions = await this.workSessionRepo.find({
      where: {
        userId,
        startTime: Between(new Date(`${weekStart} 00:00:00`), new Date(`${weekEnd} 23:59:59`)),
      },
    });

    let totalSeconds = 0;
    let activeSeconds = 0;
    let idleSeconds = 0;

    for (const session of sessions) {
      totalSeconds += session.totalDuration;
      activeSeconds += session.activeDuration;
      idleSeconds += session.idleDuration;
    }

    const totalHoursWorked = +(totalSeconds / 3600).toFixed(2);
    const activeHours = +(activeSeconds / 3600).toFixed(2);
    const idleHours = +(idleSeconds / 3600).toFixed(2);

    // Average focus score for the week
    const focusScores = await this.focusScoreRepo
      .createQueryBuilder('fs')
      .where('fs.userId = :userId', { userId })
      .andWhere('fs.date >= :weekStart', { weekStart })
      .andWhere('fs.date <= :weekEnd', { weekEnd })
      .getMany();

    let focusScore = 0;
    if (focusScores.length > 0) {
      const sum = focusScores.reduce((acc, fs) => acc + Number(fs.score), 0);
      focusScore = +(sum / focusScores.length).toFixed(2);
    }

    // KPI summary
    const kpiEntries = await this.kpiEntryRepo
      .createQueryBuilder('ke')
      .leftJoinAndSelect('ke.kpiDefinition', 'kd')
      .where('ke.userId = :userId', { userId })
      .andWhere('ke.periodStart >= :weekStart', { weekStart })
      .andWhere('ke.periodStart <= :weekEnd', { weekEnd })
      .getMany();

    const kpiSummary = kpiEntries.map((entry) => ({
      metric: entry.kpiDefinition?.metricName,
      value: entry.value,
      unit: entry.kpiDefinition?.unit,
    }));

    // Payable amount
    const user = await this.userRepo.findOne({ where: { id: userId } });
    const payableAmount = user
      ? +(totalHoursWorked * Number(user.hourlyRate)).toFixed(2)
      : 0;

    // Upsert report
    let report = await this.reportRepo.findOne({
      where: { userId, weekStart },
    });

    if (report) {
      report.weekEnd = weekEnd;
      report.totalHoursWorked = totalHoursWorked;
      report.activeHours = activeHours;
      report.idleHours = idleHours;
      report.focusScore = focusScore;
      report.kpiSummary = JSON.stringify(kpiSummary);
      report.payableAmount = payableAmount;
    } else {
      report = this.reportRepo.create({
        userId,
        weekStart,
        weekEnd,
        totalHoursWorked,
        activeHours,
        idleHours,
        focusScore,
        kpiSummary: JSON.stringify(kpiSummary),
        payableAmount,
        ...(organizationId ? { organizationId } : {}),
      });
    }

    return this.reportRepo.save(report);
  }

  async generateAllWeeklyReports(
    weekStart: string,
    weekEnd: string,
    organizationId?: string,
  ): Promise<void> {
    this.logger.log(`Generating weekly reports for ${weekStart} to ${weekEnd}`);

    const whereClause: any = { status: 'active' as any };
    if (organizationId) {
      whereClause.organizationId = organizationId;
    }

    const users = await this.userRepo.find({
      where: whereClause,
    });

    for (const user of users) {
      try {
        await this.generateWeeklyReport(user.id, weekStart, weekEnd, organizationId);
      } catch (error) {
        this.logger.error(
          `Failed to generate report for user ${user.id}: ${error.message}`,
        );
      }
    }

    this.logger.log('Completed weekly report generation');
  }

  async getWeeklyReports(
    query: ReportQueryDto,
    organizationId?: string,
  ): Promise<PaginatedResponseDto<WeeklyReport>> {
    const { weekStart, userId, page, limit } = query;
    const skip = (page - 1) * limit;

    const qb = this.reportRepo.createQueryBuilder('r')
      .leftJoinAndSelect('r.user', 'user')
      .where('r.weekStart = :weekStart', { weekStart });

    if (organizationId) {
      qb.andWhere('r.organizationId = :organizationId', { organizationId });
    }

    if (userId) {
      qb.andWhere('r.userId = :userId', { userId });
    }

    const [data, total] = await qb
      .orderBy('user.firstName', 'ASC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return new PaginatedResponseDto(data, total, page, limit);
  }

  async getReportById(id: string): Promise<WeeklyReport> {
    const report = await this.reportRepo.findOne({
      where: { id },
      relations: ['user'],
    });

    if (!report) {
      throw new NotFoundException('Report not found');
    }

    return report;
  }

  async exportCsv(weekStart: string, organizationId?: string): Promise<string> {
    const where: any = { weekStart };
    if (organizationId) {
      where.organizationId = organizationId;
    }
    const reports = await this.reportRepo.find({
      where,
      relations: ['user'],
      order: { userId: 'ASC' },
    });

    const headers = [
      'Employee Name',
      'Email',
      'Week Start',
      'Week End',
      'Total Hours',
      'Active Hours',
      'Idle Hours',
      'Focus Score',
      'Payable Amount',
    ].join(',');

    const rows = reports.map((r) => {
      const name = r.user ? `${r.user.firstName} ${r.user.lastName}` : 'N/A';
      const email = r.user?.email ?? 'N/A';
      return [
        `"${name}"`,
        email,
        r.weekStart,
        r.weekEnd,
        r.totalHoursWorked,
        r.activeHours,
        r.idleHours,
        r.focusScore,
        r.payableAmount,
      ].join(',');
    });

    return [headers, ...rows].join('\n');
  }

  async exportPdf(weekStart: string, organizationId?: string): Promise<Buffer> {
    // Basic PDF generation — plain text approach
    // Can be enhanced with pdfkit or puppeteer later
    const where: any = { weekStart };
    if (organizationId) {
      where.organizationId = organizationId;
    }
    const reports = await this.reportRepo.find({
      where,
      relations: ['user'],
      order: { userId: 'ASC' },
    });

    const lines: string[] = [];
    lines.push(`Weekly Report - Week of ${weekStart}`);
    lines.push('='.repeat(50));
    lines.push('');

    for (const r of reports) {
      const name = r.user ? `${r.user.firstName} ${r.user.lastName}` : 'N/A';
      lines.push(`Employee: ${name}`);
      lines.push(`Email: ${r.user?.email ?? 'N/A'}`);
      lines.push(`Total Hours: ${r.totalHoursWorked}`);
      lines.push(`Active Hours: ${r.activeHours}`);
      lines.push(`Idle Hours: ${r.idleHours}`);
      lines.push(`Focus Score: ${r.focusScore}`);
      lines.push(`Payable Amount: $${r.payableAmount}`);
      lines.push('-'.repeat(30));
      lines.push('');
    }

    return Buffer.from(lines.join('\n'), 'utf-8');
  }
}
