import apiClient from './client';
import type { WorkSession, PaginatedResponse, ApiResponse } from '../types';

export interface SessionQueryParams {
  startDate?: string;
  endDate?: string;
  userId?: string;
  page?: number;
  limit?: number;
}

export const timeTrackingApi = {
  getSessions(params: SessionQueryParams): Promise<ApiResponse<PaginatedResponse<WorkSession>>> {
    return apiClient.get('/time-tracking/sessions', { params });
  },

  getActiveSessions(): Promise<ApiResponse<WorkSession[]>> {
    return apiClient.get('/time-tracking/sessions/active');
  },
};
