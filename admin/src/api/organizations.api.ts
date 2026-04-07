import apiClient from './client';
import type { Organization, ApiResponse } from '../types';

export const organizationsApi = {
  getCurrent(): Promise<ApiResponse<Organization>> {
    return apiClient.get('/organizations/current');
  },
  updateCurrent(data: Partial<Organization>): Promise<ApiResponse<Organization>> {
    return apiClient.patch('/organizations/current', data);
  },
  uploadLogo(file: File): Promise<ApiResponse<Organization>> {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.post('/organizations/current/logo', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};
