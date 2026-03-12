import apiClient from './client';
import type { ApiResponse, PaginatedResponse } from '../types';
import type { LeaveRequest } from '../types';

export interface GetLeaveRequestsParams {
  page?: number;
  limit?: number;
}

export const leaveRequestsApi = {
  getAll(params?: GetLeaveRequestsParams): Promise<ApiResponse<PaginatedResponse<LeaveRequest>>> {
    return apiClient.get('/leave-requests', { params });
  },

  getById(id: string): Promise<ApiResponse<LeaveRequest>> {
    return apiClient.get(`/leave-requests/${id}`);
  },

  approve(id: string, adminNotes?: string): Promise<ApiResponse<LeaveRequest>> {
    return apiClient.patch(`/leave-requests/${id}/status`, {
      status: 'approved',
      adminNotes,
    });
  },

  reject(id: string, adminNotes?: string): Promise<ApiResponse<LeaveRequest>> {
    return apiClient.patch(`/leave-requests/${id}/status`, {
      status: 'rejected',
      adminNotes,
    });
  },

  getAttachments(id: string): Promise<{ key: string; url: string; filename: string }[]> {
    return apiClient.get(`/leave-requests/${id}/attachments`);
  },
};
