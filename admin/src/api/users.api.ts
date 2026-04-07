import apiClient from './client';
import type { ApiResponse, PaginatedResponse, User } from '../types';

export interface GetUsersParams {
  page?: number;
  limit?: number;
  search?: string;
  role?: string;
  status?: string;
  organizationId?: string;
}

export interface CreateUserData {
  email: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'employee';
  designation?: string;
  hourlyRate: number;
  shiftId?: string;
  allowedLeavesPerYear?: number;
}

export interface UpdateUserData {
  firstName?: string;
  lastName?: string;
  role?: 'admin' | 'employee';
  designation?: string;
  hourlyRate?: number;
  shiftId?: string | null;
  allowedLeavesPerYear?: number;
}

export const usersApi = {
  getUsers: (params?: GetUsersParams) =>
    apiClient.get<unknown, ApiResponse<PaginatedResponse<User>>>('/users', { params }),

  createUser: (data: CreateUserData) =>
    apiClient.post<unknown, ApiResponse<User>>('/users', data),

  updateUser: (id: string, data: UpdateUserData) =>
    apiClient.patch<unknown, ApiResponse<User>>(`/users/${id}`, data),

  deactivateUser: (id: string) =>
    apiClient.patch<unknown, ApiResponse<User>>(`/users/${id}/deactivate`),

  deleteUser: (id: string) =>
    apiClient.delete<unknown, ApiResponse<null>>(`/users/${id}`),

  resendInvite: (id: string) =>
    apiClient.post<unknown, ApiResponse<null>>(`/users/${id}/resend-invite`),
};
