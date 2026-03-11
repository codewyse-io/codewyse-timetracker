import apiClient from './client';
import type { WeeklyReport, ApiResponse, PaginatedResponse } from '../types';

export interface ReportQueryParams {
  weekStart?: string;
  page?: number;
  limit?: number;
}

export const reportsApi = {
  getWeeklyReports(params: ReportQueryParams): Promise<ApiResponse<PaginatedResponse<WeeklyReport>>> {
    return apiClient.get('/reports/weekly', { params });
  },

  getReportById(id: string): Promise<ApiResponse<WeeklyReport>> {
    return apiClient.get(`/reports/weekly/${id}`);
  },

  exportCsv(weekStart: string): Promise<Blob> {
    return apiClient.get('/reports/weekly/export/csv', {
      params: { weekStart },
      responseType: 'blob',
    });
  },

  exportPdf(weekStart: string): Promise<Blob> {
    return apiClient.get('/reports/weekly/export/pdf', {
      params: { weekStart },
      responseType: 'blob',
    });
  },
};
