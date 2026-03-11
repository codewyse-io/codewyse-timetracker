import apiClient from './client';
import type { AiInsight, CoachingTip, ApiResponse } from '../types';

export interface InsightQueryParams {
  type?: 'productivity' | 'time_usage' | 'pattern' | 'team';
  startDate?: string;
  endDate?: string;
}

export interface CoachingQueryParams {
  category?: 'productivity' | 'time_usage' | 'workload';
  startDate?: string;
  endDate?: string;
}

export interface EmployeeCoachingGroup {
  userId: string;
  user: { firstName: string; lastName: string };
  tips: CoachingTip[];
}

export const insightsApi = {
  getTeamInsights(params?: InsightQueryParams): Promise<ApiResponse<AiInsight[]>> {
    return apiClient.get('/insights/team', { params });
  },

  getEmployeeInsights(userId: string): Promise<ApiResponse<{ insights: AiInsight[]; coaching: CoachingTip[] }>> {
    return apiClient.get(`/insights/employee/${userId}`);
  },

  getTeamCoaching(params?: CoachingQueryParams): Promise<ApiResponse<EmployeeCoachingGroup[]>> {
    return apiClient.get('/insights/coaching', { params });
  },

  generateInsights(): Promise<ApiResponse<{ message: string }>> {
    return apiClient.post('/insights/generate');
  },
};
