import apiClient from './client';
import type { ApiResponse } from '../types';

export interface Announcement {
  id: string;
  title: string;
  message: string;
  type: 'general' | 'holiday' | 'meeting' | 'memo' | 'urgent';
  priority: 'low' | 'normal' | 'high';
  createdBy: string;
  author: { id: string; firstName: string; lastName: string };
  isActive: boolean;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAnnouncementData {
  title: string;
  message: string;
  type?: Announcement['type'];
  priority?: Announcement['priority'];
  expiresAt?: string;
}

export const announcementsApi = {
  getAll: () =>
    apiClient.get<unknown, ApiResponse<Announcement[]>>('/announcements'),

  create: (data: CreateAnnouncementData) =>
    apiClient.post<unknown, ApiResponse<Announcement>>('/announcements', data),

  deactivate: (id: string) =>
    apiClient.patch<unknown, ApiResponse<Announcement>>(`/announcements/${id}/deactivate`),

  delete: (id: string) =>
    apiClient.delete<unknown, ApiResponse<null>>(`/announcements/${id}`),
};
