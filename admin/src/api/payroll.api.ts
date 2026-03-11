import apiClient from './client';
import type { PayrollEntry, ApiResponse } from '../types';

export interface PayrollSummary {
  totalPayable: number;
  totalActiveHours: number;
  averageHourlyRate: number;
  employeeCount: number;
  entries: PayrollEntry[];
}

export interface PayrollQueryParams {
  startDate?: string;
  endDate?: string;
}

export const payrollApi = {
  getWeeklyPayroll(weekStart: string): Promise<ApiResponse<PayrollSummary>> {
    return apiClient.get('/payroll/weekly', { params: { weekStart } });
  },

  getMonthlyPayroll(year: number, month: number): Promise<ApiResponse<PayrollSummary>> {
    return apiClient.get('/payroll/monthly', { params: { year, month } });
  },

  getEmployeePayroll(userId: string, params?: PayrollQueryParams): Promise<ApiResponse<PayrollEntry>> {
    return apiClient.get(`/payroll/employee/${userId}`, { params });
  },

  getPayrollSummary(params?: PayrollQueryParams): Promise<ApiResponse<PayrollSummary>> {
    return apiClient.get('/payroll/summary', { params });
  },
};
