import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    try {
      const token = await window.electronAPI.getAuthToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch {
      // electronAPI might not be available in dev browser mode
    }
    return config;
  },
  (error) => Promise.reject(error)
);

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      window.electronAPI?.clearAuthToken();
    }
    return Promise.reject(error);
  }
);

export async function login(email: string, password: string) {
  const response = await apiClient.post('/auth/login', { email, password });
  return response.data;
}

export async function getMe() {
  const response = await apiClient.get('/auth/me');
  return response.data;
}

export async function startSession(mode: 'regular' | 'overtime' = 'regular') {
  const response = await apiClient.post('/time-tracking/start', { mode });
  return response.data;
}

export async function stopSession() {
  const response = await apiClient.post('/time-tracking/stop');
  return response.data;
}

export async function getCurrentSession() {
  const response = await apiClient.get('/time-tracking/current');
  return response.data;
}

export async function getSessions(params?: { page?: number; limit?: number; startDate?: string; endDate?: string }) {
  const response = await apiClient.get('/time-tracking/sessions', { params });
  return response.data;
}

export async function reportIdle(data: { startTime: string; endTime: string }) {
  const response = await apiClient.post('/time-tracking/idle', data);
  return response.data;
}

export async function getFocusScore(period?: string) {
  const response = await apiClient.get('/focus-score/me', { params: { period } });
  return response.data;
}

export async function getCoachingTips() {
  const response = await apiClient.get('/coaching/me');
  return response.data;
}

export default apiClient;
