import apiClient from './client';
import type { ApiResponse } from '../types';

export type PeerReviewCategory =
  | 'performance'
  | 'responsibility'
  | 'knowledge'
  | 'leadership_collaboration';

export interface PeerReviewSurveySummary {
  id: string;
  periodMonth: string;
  opensAt: string;
  closesAt: string;
  status: 'open' | 'closed';
  responseCount: number;
  participantCount: number;
}

export interface PeerReviewResponseDetail {
  id: string;
  reviewer: { id: string; firstName: string; lastName: string };
  submittedAt: string | null;
  comment: string | null;
  answers: Array<{ questionKey: string; category: PeerReviewCategory; score: number }>;
}

export interface PeerReviewResult {
  reviewee: { id: string; firstName: string; lastName: string };
  reviewerCount: number;
  overallAverage: number;
  categoryAverages: Record<PeerReviewCategory, number>;
  responses: PeerReviewResponseDetail[];
}

export interface PeerReviewResultsResponse {
  survey: {
    id: string;
    periodMonth: string;
    opensAt: string;
    closesAt: string;
    status: 'open' | 'closed';
  };
  results: PeerReviewResult[];
}

export const peerReviewsApi = {
  listSurveys(): Promise<ApiResponse<PeerReviewSurveySummary[]>> {
    return apiClient.get('/peer-reviews/admin/surveys');
  },
  getResults(surveyId: string): Promise<ApiResponse<PeerReviewResultsResponse>> {
    return apiClient.get(`/peer-reviews/admin/surveys/${surveyId}/results`);
  },
  getQuestions(): Promise<
    ApiResponse<Array<{ key: string; category: PeerReviewCategory; prompt: string }>>
  > {
    return apiClient.get('/peer-reviews/questions');
  },
  openSurvey(payload: { periodMonth?: string; openDays?: number } = {}): Promise<
    ApiResponse<{ id: string; periodMonth: string; opensAt: string; closesAt: string; status: 'open' | 'closed' }>
  > {
    return apiClient.post('/peer-reviews/admin/surveys/open', payload);
  },
};
