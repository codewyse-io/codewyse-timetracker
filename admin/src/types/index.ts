// Organization types
export interface Organization {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  primaryColor: string;
  emailFromName: string;
  createdAt: string;
  updatedAt: string;
}

// User types
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'super_admin' | 'admin' | 'employee';
  designation: string | null;
  hourlyRate: number;
  shiftId: string | null;
  allowedLeavesPerYear: number;
  consumedLeaves: number;
  status: 'invited' | 'active' | 'deactivated';
  organizationId?: string;
  bankName?: string | null;
  accountHolderName?: string | null;
  accountNumber?: string | null;
  iban?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Shift {
  id: string;
  name: string;
  startTime: string; // "HH:mm"
  endTime: string;
  allowedDays: string[];
  timezone: string; // IANA timezone, e.g. "America/New_York"
  idleThresholdMinutes: number;
  isActive: boolean;
  createdAt: string;
}

export interface WorkSession {
  id: string;
  userId: string;
  user?: User;
  startTime: string;
  endTime: string | null;
  totalDuration: number;
  idleDuration: number;
  activeDuration: number;
  status: 'active' | 'completed';
  mode?: string;
}

export interface FocusScore {
  id: string;
  userId: string;
  date: string;
  score: number;
  category: 'deep_focus' | 'good_focus' | 'moderate' | 'low_focus';
  totalActiveTime: number;
  totalLoggedTime: number;
  idleInterruptions: number;
}

export interface PayrollEntry {
  userId: string;
  user: User;
  activeHours: number;
  hourlyRate: number;
  payableAmount: number;
}

export interface KpiDefinition {
  id: string;
  designation: string;
  metricName: string;
  description: string;
  unit: string;
}

export interface KpiEntry {
  id: string;
  userId: string;
  kpiDefinitionId: string;
  kpiDefinition?: KpiDefinition;
  value: number;
  period: 'weekly' | 'monthly';
  periodStart: string;
}

export interface WeeklyReport {
  id: string;
  userId: string;
  user?: User;
  weekStart: string;
  weekEnd: string;
  totalHoursWorked: number;
  activeHours: number;
  idleHours: number;
  focusScore: number;
  kpiSummary: any;
  payableAmount: number;
}

export interface AiInsight {
  id: string;
  userId: string;
  type: 'productivity' | 'time_usage' | 'pattern' | 'team';
  insight: string;
  recommendation: string;
  generatedAt: string;
}

export interface CoachingTip {
  id: string;
  userId: string;
  category: 'productivity' | 'time_usage' | 'workload';
  observation: string;
  recommendation: string;
  generatedAt: string;
}

export interface LeaveRequest {
  id: string;
  userId: string;
  user?: User;
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

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
}
