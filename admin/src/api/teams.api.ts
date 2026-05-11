import apiClient from './client';
import type { ApiResponse } from '../types';

export interface TeamMember {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  designation: string | null;
}

export interface Team {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  memberCount: number;
  members: TeamMember[];
}

export const teamsApi = {
  list(): Promise<ApiResponse<Team[]>> {
    return apiClient.get('/teams');
  },
  create(payload: { name: string; description?: string; memberIds?: string[] }): Promise<ApiResponse<Team>> {
    return apiClient.post('/teams', payload);
  },
  update(id: string, payload: { name?: string; description?: string }): Promise<ApiResponse<Team>> {
    return apiClient.patch(`/teams/${id}`, payload);
  },
  remove(id: string): Promise<ApiResponse<{ deleted: true }>> {
    return apiClient.delete(`/teams/${id}`);
  },
  assignMembers(id: string, memberIds: string[]): Promise<ApiResponse<Team[]>> {
    return apiClient.put(`/teams/${id}/members`, { memberIds });
  },
  getUserTeams(userId: string): Promise<ApiResponse<string[]>> {
    return apiClient.get(`/teams/users/${userId}`);
  },
  setUserTeams(userId: string, teamIds: string[]): Promise<ApiResponse<string[]>> {
    return apiClient.put(`/teams/users/${userId}`, { teamIds });
  },
};
