import apiClient from './client';
import type { Organization, ApiResponse } from '../types';

export interface OrgWithStats extends Organization {
  totalUsers: number;
  activeUsers: number;
  activeSessions: number;
  totalSessionsThisMonth: number;
}

export interface SuperAdminDashboard {
  totalOrganizations: number;
  totalUsers: number;
  activeUsers: number;
  organizations: OrgWithStats[];
}

export const superAdminApi = {
  getDashboard(): Promise<ApiResponse<SuperAdminDashboard>> {
    return apiClient.get('/super-admin/dashboard');
  },

  getOrganizations(): Promise<ApiResponse<Organization[]>> {
    return apiClient.get('/organizations');
  },

  getOrganization(id: string): Promise<ApiResponse<Organization>> {
    return apiClient.get(`/organizations/${id}`);
  },

  createOrganization(data: { name: string; slug: string; emailFromName?: string; primaryColor?: string }): Promise<ApiResponse<Organization>> {
    return apiClient.post('/organizations', data);
  },

  updateOrganization(id: string, data: Partial<Organization>): Promise<ApiResponse<Organization>> {
    return apiClient.patch(`/organizations/${id}`, data);
  },

  deleteOrganization(id: string): Promise<ApiResponse<void>> {
    return apiClient.delete(`/organizations/${id}`);
  },

  getOrgStats(id: string): Promise<ApiResponse<{ totalUsers: number; activeUsers: number; activeSessions: number; totalSessionsThisMonth: number }>> {
    return apiClient.get(`/organizations/${id}/stats`);
  },
};
