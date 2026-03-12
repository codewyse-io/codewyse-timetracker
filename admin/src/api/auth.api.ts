import apiClient from './client';
import type { ApiResponse, User } from '../types';

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export const authApi = {
  login: (email: string, password: string) =>
    apiClient.post<unknown, ApiResponse<LoginResponse>>('/auth/admin-login', { email, password }),

  refreshToken: (refreshToken: string) =>
    apiClient.post<unknown, ApiResponse<{ accessToken: string; refreshToken: string }>>(
      '/auth/refresh',
      { refreshToken }
    ),

  logout: () => apiClient.post<unknown, ApiResponse<null>>('/auth/logout'),

  getMe: () => apiClient.get<unknown, ApiResponse<User>>('/auth/me'),
};
