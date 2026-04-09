export interface Shift {
  id: string;
  name: string;
  startTime: string; // "HH:mm"
  endTime: string;   // "HH:mm"
  allowedDays: string[];
  timezone: string;  // IANA e.g. "America/New_York"
  isActive: boolean;
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  designation?: string;
  hourlyRate: number;
  shiftId: string | null;
  shift?: Shift | null;
  status: string;
  createdAt?: string;
}

export interface WorkSession {
  id: string;
  userId: string;
  startTime: string;
  endTime: string | null;
  totalDuration: number;
  idleDuration: number;
  activeDuration: number;
  status: string;
  mode?: string;
}

export interface FocusScore {
  id: string;
  date: string;
  score: number;
  category: string;
  totalActiveTime: number;
  totalLoggedTime: number;
  idleInterruptions: number;
}

export interface CoachingTip {
  id: string;
  category: string;
  observation: string;
  recommendation: string;
  generatedAt: string;
}

export interface LeaveRequest {
  id: string;
  userId: string;
  subject: string;
  message: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  attachments: string[] | null;
  status: 'pending' | 'approved' | 'rejected';
  adminNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface IdleEvent {
  startTime: string;
  endTime: string;
  duration: number;
}

export interface Meeting {
  id: string;
  title: string;
  meetingUrl: string | null;
  platform: 'google_meet' | 'zoom' | 'teams' | 'other';
  scheduledStart: string | null;
  scheduledEnd: string | null;
  status: 'scheduled' | 'bot_joining' | 'recording' | 'processing' | 'completed' | 'failed';
  recordingS3Key: string | null;
  transcriptText: string | null;
  summary: string | null;
  actionItems: { task: string; assignee?: string }[] | null;
  durationSeconds: number | null;
  participants: string[] | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GoogleCalendarStatus {
  connected: boolean;
  email?: string;
}

declare global {
  interface Window {
    electronAPI: {
      getIdleTime: () => Promise<number>;
      getAuthToken: () => Promise<string | null>;
      setAuthToken: (token: string) => Promise<void>;
      clearAuthToken: () => Promise<void>;
      setIdleThreshold: (seconds: number) => Promise<void>;
      startIdleDetection: () => Promise<void>;
      stopIdleDetection: () => Promise<void>;
      minimizeToTray: () => void;
      quitApp: () => void;
      onIdleDetected: (callback: (data: { startTime: string }) => void) => () => void;
      onIdleResumed: (callback: (data: IdleEvent) => void) => () => void;
      // Auto-update
      checkForUpdates: () => Promise<any>;
      downloadUpdate: () => Promise<any>;
      installUpdate: () => Promise<void>;
      getAppVersion: () => Promise<string>;
      onUpdateAvailable: (callback: (info: { version: string; releaseNotes: string }) => void) => () => void;
      onUpdateNotAvailable: (callback: () => void) => () => void;
      onUpdateDownloadProgress: (callback: (progress: { percent: number; transferred: number; total: number }) => void) => () => void;
      onUpdateDownloaded: (callback: () => void) => () => void;
      onUpdateError: (callback: (message: string) => void) => () => void;
      // Main-process heartbeat
      startHeartbeat: () => Promise<void>;
      stopHeartbeat: () => Promise<void>;
      onSessionForceStopped: (callback: (reason?: string) => void) => () => void;
      // Screen sharing & call notifications
      getDesktopSources: () => Promise<Array<{ id: string; name: string; thumbnail: string }>>;
      selectScreenSource: (sourceId: string) => Promise<boolean>;
      isWindowVisible: () => Promise<boolean>;
      showCallNotification: (callerName: string) => void;
      // Call detach/attach
      detachCallWindow: () => Promise<void>;
      attachCallWindow: () => Promise<void>;
      onCallDetached: (callback: () => void) => () => void;
      onCallAttached: (callback: () => void) => () => void;
    };
  }
}
