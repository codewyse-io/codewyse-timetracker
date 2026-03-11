import apiClient from './client';
import type { KpiDefinition, KpiEntry, ApiResponse, PaginatedResponse } from '../types';

export interface CreateKpiEntryData {
  userId: string;
  kpiDefinitionId: string;
  value: number;
  period: 'weekly' | 'monthly';
  periodStart: string;
}

export interface KpiQueryParams {
  startDate?: string;
  endDate?: string;
  period?: 'weekly' | 'monthly';
  page?: number;
  limit?: number;
}

export interface TeamKpiRow {
  userId: string;
  user: { firstName: string; lastName: string; designation: string };
  kpis: Record<string, { value: number; unit: string }>;
}

export const kpisApi = {
  getDefinitions(designation?: string): Promise<ApiResponse<KpiDefinition[]>> {
    return apiClient.get('/kpis/definitions', { params: designation ? { designation } : undefined });
  },

  createEntry(data: CreateKpiEntryData): Promise<ApiResponse<KpiEntry>> {
    return apiClient.post('/kpis/entry', data);
  },

  bulkCreateEntries(entries: CreateKpiEntryData[]): Promise<ApiResponse<KpiEntry[]>> {
    return apiClient.post('/kpis/entries/bulk', { entries });
  },

  getEmployeeKpis(userId: string, params?: KpiQueryParams): Promise<ApiResponse<PaginatedResponse<KpiEntry>>> {
    return apiClient.get(`/kpis/employee/${userId}`, { params });
  },

  getTeamKpis(params?: KpiQueryParams): Promise<ApiResponse<TeamKpiRow[]>> {
    return apiClient.get('/kpis/team', { params });
  },
};
