import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WorkSession } from '../time-tracking/entities/work-session.entity';
import { SessionStatus } from '../time-tracking/enums/session-status.enum';

export interface PayrollEntry {
  userId: string;
  user: {
    firstName: string;
    lastName: string;
    email: string;
    role: string;
  };
  activeHours: number;
  hourlyRate: number;
  payableAmount: number;
}

export interface PayrollSummary {
  startDate: string;
  endDate: string;
  totalEmployees: number;
  employeeCount: number;
  totalActiveHours: number;
  totalPayable: number;
  averageHourlyRate: number;
  entries: PayrollEntry[];
}

@Injectable()
export class PayrollService {
  constructor(
    @InjectRepository(WorkSession)
    private readonly sessionRepository: Repository<WorkSession>,
  ) {}

  /**
   * Get weekly payroll starting from a given Monday.
   */
  async getWeeklyPayroll(weekStart: Date): Promise<PayrollSummary> {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    return this.computePayroll(weekStart, weekEnd);
  }

  /**
   * Get monthly payroll for a given year and month.
   */
  async getMonthlyPayroll(
    year: number,
    month: number,
  ): Promise<PayrollSummary> {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999); // last day of month

    return this.computePayroll(startDate, endDate);
  }

  /**
   * Get payroll for an individual employee.
   */
  async getEmployeePayroll(
    userId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<PayrollEntry> {
    const start = startDate ?? this.getMonthStart();
    const end = endDate ?? new Date();
    end.setHours(23, 59, 59, 999);

    const rows = await this.getAggregatedPayrollData(start, end, userId);

    if (!rows.length) {
      throw new NotFoundException(
        `No completed sessions found for user "${userId}" in the given period.`,
      );
    }

    return this.mapRowToEntry(rows[0]);
  }

  /**
   * Get a summary of total payable for a period.
   */
  async getPayrollSummary(
    startDate: Date,
    endDate: Date,
  ): Promise<PayrollSummary> {
    endDate.setHours(23, 59, 59, 999);
    return this.computePayroll(startDate, endDate);
  }

  // ── Private helpers ──────────────────────────────────────────────

  private async computePayroll(
    startDate: Date,
    endDate: Date,
  ): Promise<PayrollSummary> {
    const rows = await this.getAggregatedPayrollData(startDate, endDate);

    const entries = rows.map((row) => this.mapRowToEntry(row));

    const totalActiveHours = entries.reduce(
      (sum, e) => sum + e.activeHours,
      0,
    );
    const totalPayable = entries.reduce((sum, e) => sum + e.payableAmount, 0);
    const averageHourlyRate =
      entries.length > 0
        ? entries.reduce((sum, e) => sum + e.hourlyRate, 0) / entries.length
        : 0;

    return {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      totalEmployees: entries.length,
      employeeCount: entries.length,
      totalActiveHours: Math.round(totalActiveHours * 100) / 100,
      totalPayable: Math.round(totalPayable * 100) / 100,
      averageHourlyRate: Math.round(averageHourlyRate * 100) / 100,
      entries,
    };
  }

  /**
   * Raw query to aggregate active durations per user, joined with user data.
   * Uses raw query since we don't own the User entity.
   */
  private async getAggregatedPayrollData(
    startDate: Date,
    endDate: Date,
    userId?: string,
  ): Promise<any[]> {
    let query = `
      SELECT
        ws.user_id       AS userId,
        u.email          AS email,
        u.firstName      AS firstName,
        u.lastName       AS lastName,
        u.role           AS role,
        u.hourlyRate     AS hourlyRate,
        SUM(ws.active_duration) AS totalActiveSeconds
      FROM work_sessions ws
      INNER JOIN users u ON u.id = ws.user_id
      WHERE ws.status = ?
        AND ws.start_time >= ?
        AND ws.end_time <= ?
    `;

    const params: any[] = [SessionStatus.COMPLETED, startDate, endDate];

    if (userId) {
      query += ' AND ws.user_id = ?';
      params.push(userId);
    }

    query += ' GROUP BY ws.user_id, u.email, u.firstName, u.lastName, u.role, u.hourlyRate';

    return this.sessionRepository.query(query, params);
  }

  private mapRowToEntry(row: any): PayrollEntry {
    const totalActiveSeconds = parseInt(row.totalActiveSeconds, 10) || 0;
    const activeHours =
      Math.round((totalActiveSeconds / 3600) * 100) / 100;
    const hourlyRate = parseFloat(row.hourlyRate) || 0;
    const payableAmount = Math.round(activeHours * hourlyRate * 100) / 100;

    return {
      userId: row.userId,
      user: {
        firstName: row.firstName,
        lastName: row.lastName,
        email: row.email,
        role: row.role || 'employee',
      },
      activeHours,
      hourlyRate,
      payableAmount,
    };
  }

  private getMonthStart(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }
}
