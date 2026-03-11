import apiClient from './client';
import type { ApiResponse, Shift } from '../types';

export interface CreateShiftData {
  name: string;
  startTime: string;
  endTime: string;
  allowedDays: string[];
  timezone?: string;
}

export interface UpdateShiftData {
  name?: string;
  startTime?: string;
  endTime?: string;
  allowedDays?: string[];
  timezone?: string;
  isActive?: boolean;
}

export const shiftsApi = {
  getShifts: () =>
    apiClient.get<unknown, ApiResponse<Shift[]>>('/shifts'),

  createShift: (data: CreateShiftData) =>
    apiClient.post<unknown, ApiResponse<Shift>>('/shifts', data),

  updateShift: (id: string, data: UpdateShiftData) =>
    apiClient.patch<unknown, ApiResponse<Shift>>(`/shifts/${id}`, data),

  deleteShift: (id: string) =>
    apiClient.delete<unknown, ApiResponse<null>>(`/shifts/${id}`),
};
