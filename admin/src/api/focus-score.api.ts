import apiClient from './client';
import type { FocusScore, ApiResponse } from '../types';

export interface FocusScoreQueryParams {
  startDate?: string;
  endDate?: string;
  userId?: string;
}

export const focusScoreApi = {
  getTeamFocusScores(params?: FocusScoreQueryParams): Promise<ApiResponse<FocusScore[]>> {
    return apiClient.get('/focus-score/team', { params });
  },
};
