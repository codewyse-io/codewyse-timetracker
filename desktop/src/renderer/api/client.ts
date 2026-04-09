import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://backend.codewyse.site';

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
      window.dispatchEvent(new Event('auth-expired'));
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

export async function getTrackingSettings(): Promise<any> {
  const response = await apiClient.get('/time-tracking/settings');
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

export async function sendHeartbeat() {
  const response = await apiClient.post('/time-tracking/heartbeat');
  return response.data;
}

export async function getFocusScore(period?: string) {
  const response = await apiClient.get('/focus-score/me', { params: { period } });
  return response.data;
}

export async function getCoachingTips() {
  const response = await apiClient.get('/insights/coaching/me');
  return response.data;
}

// Leave Requests
export async function getMyLeaveRequests() {
  const response = await apiClient.get('/leave-requests/my');
  return response.data;
}

export async function createLeaveRequest(data: FormData) {
  const response = await apiClient.post('/leave-requests', data, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
}

export async function changePassword(currentPassword: string, newPassword: string) {
  const response = await apiClient.post('/auth/change-password', { currentPassword, newPassword });
  return response.data;
}

export async function getActiveAnnouncements() {
  const response = await apiClient.get('/announcements/active');
  return response.data;
}

// Google Calendar
export async function getGoogleCalendarAuthUrl() {
  const res = await apiClient.get('/google-calendar/auth-url');
  return res.data;
}
export async function getGoogleCalendarStatus() {
  const res = await apiClient.get('/google-calendar/status');
  return res.data;
}
export async function disconnectGoogleCalendar() {
  const res = await apiClient.post('/google-calendar/disconnect');
  return res.data;
}
export async function syncGoogleCalendar() {
  const res = await apiClient.post('/google-calendar/sync');
  return res.data;
}

// Meetings
export async function getMeetings(params?: { page?: number; limit?: number; startDate?: string; endDate?: string }) {
  const res = await apiClient.get('/meetings', { params });
  return res.data;
}
export async function createMeeting(data: { title: string; meetingUrl: string; scheduledStart?: string; scheduledEnd?: string }) {
  const res = await apiClient.post('/meetings', data);
  return res.data;
}
export async function startMeetingRecording(meetingId: string) {
  const res = await apiClient.post(`/meetings/${meetingId}/record`);
  return res.data;
}
export async function stopMeetingRecording(meetingId: string) {
  const res = await apiClient.post(`/meetings/${meetingId}/stop`);
  return res.data;
}
export async function getMeetingDetail(meetingId: string) {
  const res = await apiClient.get(`/meetings/${meetingId}`);
  return res.data;
}
export async function getMeetingRecordingUrl(meetingId: string) {
  const res = await apiClient.get(`/meetings/${meetingId}/recording-url`);
  return res.data;
}
export async function deleteMeeting(meetingId: string) {
  const res = await apiClient.delete(`/meetings/${meetingId}`);
  return res.data;
}

export default apiClient;
