# PulseTrack - Implementation Plan

## Product Overview

**PulseTrack** is an internal team productivity & time tracking platform designed to replace Clockify. It combines time tracking, payroll automation, KPI measurement, productivity analytics, and AI coaching.

### Tech Stack

| Component | Technology |
|-----------|-----------|
| Backend | NestJS |
| Database | MySQL |
| ORM | TypeORM |
| Queue System | BullMQ (Redis) |
| Authentication | JWT + Refresh Tokens |
| Admin Dashboard | React |
| Employee Desktop App | ElectronJS |
| AI Provider | TBD (Claude API / OpenAI) |
| Email Service | TBD (SES / SendGrid) |

### User Roles

| Role | Access |
|------|--------|
| Admin | Full access - user management, shifts, reports, payroll, productivity monitoring |
| Employee | Login, start/stop timer, view own productivity insights and weekly reports |

---

## Phase 1: Project Foundation & Authentication

### 1.1 Project Scaffold
- [ ] Initialize NestJS project with TypeScript strict mode
- [ ] Configure MySQL + TypeORM connection
- [ ] Set up environment configuration (.env)
- [ ] Configure global validation pipes (class-validator)
- [ ] Set up migrations system

### 1.2 User Entity & Management
- [ ] Create User entity
  - `id`, `email`, `firstName`, `lastName`, `password`, `role` (admin/employee)
  - `hourlyRate`, `shiftId`, `status` (invited/active/deactivated)
  - `invitationToken`, `invitationExpiry`
  - `createdAt`, `updatedAt`
- [ ] Admin: Create user endpoint (sends invitation email)
- [ ] Admin: List/update/deactivate users
- [ ] Employee: Accept invitation & set password endpoint

### 1.3 Authentication
- [ ] Login endpoint (email + password → JWT access + refresh token)
- [ ] Refresh token endpoint
- [ ] JWT strategy & guard
- [ ] Role-based access guard (Admin / Employee)
- [ ] Secure password hashing (bcrypt)

### 1.4 Email Invitation System
- [ ] Email module setup (SMTP / SendGrid / SES)
- [ ] Invitation email template
- [ ] Resend invitation endpoint

### Deliverables
- Working NestJS API with MySQL
- Admin can add users via email invitation
- Users can accept invite, set password, and login
- JWT auth with role-based guards

---

## Phase 2: Shift & Schedule Management

### 2.1 Shift Entity
- [ ] Create Shift entity
  - `id`, `name`, `startTime`, `endTime`
  - `allowedDays` (JSON array: ["monday", "tuesday", ...])
  - `createdAt`, `updatedAt`

### 2.2 Shift CRUD (Admin Only)
- [ ] Create shift endpoint
- [ ] List all shifts
- [ ] Update shift
- [ ] Delete shift (soft delete, prevent if users assigned)

### 2.3 Shift Assignment
- [ ] Assign shift to user (admin)
- [ ] Validate shift exists before assignment
- [ ] Get user's current shift

### 2.4 Shift Enforcement Logic
- [ ] Service method: `isWithinShift(userId)` → boolean
- [ ] Check current time against user's assigned shift
- [ ] Check current day against allowed working days
- [ ] Error: "Work session cannot start outside assigned shift."

### Deliverables
- Admin can create/manage shifts (e.g., Mon-Fri, 9AM-5PM)
- Shifts are assigned to employees
- Shift enforcement ready for time tracking

---

## Phase 3: Time Tracking Core

### 3.1 WorkSession Entity
- [ ] Create WorkSession entity
  - `id`, `userId`, `startTime`, `endTime`
  - `totalDuration` (seconds), `idleDuration` (seconds), `activeDuration` (seconds)
  - `status` (active/completed)
  - `createdAt`

### 3.2 IdleInterval Entity
- [ ] Create IdleInterval entity
  - `id`, `sessionId`, `startTime`, `endTime`, `duration` (seconds)

### 3.3 Session Endpoints
- [ ] **POST /time-tracking/start** — Start a work session
  - Validate: user has no active session
  - Validate: within assigned shift hours
  - Create session with `status: active`
- [ ] **POST /time-tracking/stop** — Stop active session
  - Calculate totalDuration, aggregate idleDuration, compute activeDuration
  - Set `status: completed`
- [ ] **GET /time-tracking/current** — Get active session (if any)
- [ ] **GET /time-tracking/sessions** — Session history (with date range filter)
  - Employee: own sessions
  - Admin: all sessions (filterable by userId)

### 3.4 Idle Time Reporting
- [ ] **POST /time-tracking/idle** — Report idle interval (from Electron app)
  - Payload: `{ startTime, endTime }`
  - Attached to user's current active session
  - Validate session is active
- [ ] Idle threshold configuration (default: 3 minutes)

### 3.5 Duration Calculations
- [ ] `totalDuration = endTime - startTime`
- [ ] `idleDuration = SUM(idle intervals for session)`
- [ ] `activeDuration = totalDuration - idleDuration`

### Deliverables
- Employees can start/stop work sessions
- Electron app can report idle intervals
- Idle time tracked and excluded from active duration
- Admin can view all team sessions

---

## Phase 4: Payroll & Focus Score

### 4.1 Payroll Calculation Service
- [ ] Calculate payable amount: `activeHours × hourlyRate`
- [ ] Weekly payroll aggregation per employee
- [ ] Monthly payroll aggregation per employee
- [ ] **GET /payroll/weekly** — Weekly payroll (admin only)
  - Returns: employee name, active hours, hourly rate, payable amount
- [ ] **GET /payroll/employee/:id** — Individual payroll details
- [ ] **GET /payroll/summary** — Total payroll for period

### 4.2 Focus Score System
- [ ] Focus Score formula: `(activeTime / totalLoggedTime) × 100`
- [ ] Penalty system for frequent idle interruptions
  - e.g., -2 points per idle interruption beyond threshold
- [ ] Score categories:
  - 90-100 → Deep focus
  - 75-89 → Good focus
  - 60-74 → Moderate interruptions
  - Below 60 → Low focus
- [ ] **GET /focus-score/me** — Employee's own focus score (daily/weekly)
- [ ] **GET /focus-score/team** — Team focus scores (admin only)

### 4.3 Focus Score Storage
- [ ] DailyFocusScore entity
  - `id`, `userId`, `date`, `score`, `category`
  - `totalActiveTime`, `totalLoggedTime`, `idleInterruptions`
- [ ] BullMQ job: calculate daily focus scores at end of day

### Deliverables
- Automated payroll calculation based on active hours
- Focus scores calculated daily with categories
- Admin payroll and focus score dashboards

---

## Phase 5: KPI Framework & Weekly Reports

### 5.1 KPI Entity & Configuration
- [ ] KpiDefinition entity
  - `id`, `role`, `metricName`, `description`, `unit`
- [ ] KpiEntry entity
  - `id`, `userId`, `kpiDefinitionId`, `value`, `period` (week/month), `periodStart`
- [ ] Seed role-specific KPI definitions:

| Role | KPIs |
|------|------|
| Project Manager | Sprint completion rate, Task delivery rate, Blocker resolution time, Milestone adherence |
| Product Manager | PRDs written, Feature releases, Roadmap adherence, Stakeholder satisfaction |
| Backend Developer | PRs merged, Bugs fixed, API performance, Deployment success rate |
| Frontend Developer | UI features delivered, Bug resolution time, Performance score, Code reviews |
| Mobile Developer | Builds released, Crash rate, Feature completion rate |
| QA Engineer | Bugs detected, Test coverage, Regression tests executed, Bug escape rate |
| HR | Hiring cycle time, Candidate pipeline, Retention rate, Employee satisfaction |

### 5.2 KPI Endpoints
- [ ] **POST /kpis/entry** — Submit KPI entry (admin/manager)
- [ ] **GET /kpis/employee/:id** — Get employee KPIs for period
- [ ] **GET /kpis/team** — Team KPI overview (admin)
- [ ] **GET /kpis/definitions** — List KPI definitions by role

### 5.3 Weekly Report Generation
- [ ] WeeklyReport entity
  - `id`, `userId`, `weekStart`, `weekEnd`
  - `totalHoursWorked`, `activeHours`, `idleHours`
  - `focusScore`, `kpiSummary` (JSON), `payableAmount`
- [ ] BullMQ cron job: Generate weekly reports every Sunday
- [ ] **GET /reports/weekly** — List weekly reports
- [ ] **GET /reports/weekly/:id** — Get specific report

### 5.4 Report Export
- [ ] CSV export endpoint
- [ ] PDF export endpoint (using pdfkit or puppeteer)
- [ ] Email weekly reports to admins (BullMQ job)

### Deliverables
- Role-specific KPI tracking with configurable metrics
- Automated weekly report generation
- Export reports as CSV/PDF
- Reports emailed to admins weekly

---

## Phase 6: AI Insights & Coaching

### 6.1 Data Collection Worker
- [ ] BullMQ worker: Collect and aggregate productivity data
  - Work session patterns (start times, durations, idle frequency)
  - Focus score trends (daily/weekly)
  - Peak productivity hours
  - Idle time patterns

### 6.2 AI Insight Generation
- [ ] AI service integration (Claude API / OpenAI)
- [ ] Insight types:
  - Peak productivity hours detection
  - Work pattern analysis
  - Idle time trend analysis
  - Weekly comparison trends
- [ ] AiInsight entity
  - `id`, `userId`, `type`, `insight`, `recommendation`, `generatedAt`
- [ ] BullMQ job: Generate insights weekly
- [ ] **GET /insights/me** — Employee's own insights
- [ ] **GET /insights/team** — Team insights (admin)

### 6.3 AI Productivity Coaching
- [ ] Coaching categories:
  - **Productivity Coaching** — Session length optimization, focus patterns
  - **Time Usage Coaching** — Idle time reduction, optimal scheduling
  - **Workload Coaching** — Capacity alerts, task redistribution suggestions
- [ ] AiCoachingTip entity
  - `id`, `userId`, `category`, `observation`, `recommendation`, `generatedAt`
- [ ] BullMQ job: Generate coaching tips weekly
- [ ] **GET /coaching/me** — Employee's coaching tips
- [ ] **GET /coaching/team** — Team coaching overview (admin)

### Deliverables
- AI analyzes work behavior and generates insights
- Personalized coaching recommendations for employees
- Managers see team-level insights and coaching summaries

---

## Phase 7: React Admin Dashboard

### 7.1 Project Setup
- [ ] React project with TypeScript
- [ ] Routing (React Router)
- [ ] Auth context + JWT token management
- [ ] API client (Axios with interceptors)
- [ ] UI component library (Ant Design / Shadcn)

### 7.2 Pages

| Page | Features |
|------|----------|
| Login | Email + password login |
| Dashboard | Team stats, active sessions count, weekly payroll summary, focus score overview |
| Users | List employees, add new (sends invite), edit, deactivate, assign shift/role/rate |
| Shifts | Create/edit/delete shifts, view assigned employees |
| Time Tracking | Live active sessions, session history table with filters, drill into individual sessions |
| Payroll | Weekly/monthly payroll table, individual breakdown, export CSV |
| KPIs | Team KPI dashboard, individual KPI cards, role-specific views |
| Reports | Weekly reports list, view details, download CSV/PDF |
| AI Insights | Team insights, individual employee insights, coaching summaries |

### Deliverables
- Fully functional admin dashboard
- Real-time team monitoring
- Payroll and report management
- AI insights visualization

---

## Phase 8: Electron Desktop App (Employee)

### 8.1 Project Setup
- [ ] Electron + React project setup
- [ ] Auto-updater configuration
- [ ] System tray integration

### 8.2 Authentication
- [ ] Login screen (email + password)
- [ ] Secure JWT token storage (electron-store / keytar)
- [ ] Auto-login with refresh token

### 8.3 Time Tracking UI
- [ ] Start/Stop timer button with elapsed time display
- [ ] Session history view (today/week)
- [ ] Shift info display (assigned shift hours)

### 8.4 Idle Detection
- [ ] Monitor mouse activity (powerMonitor / desktopCapturer)
- [ ] Monitor keyboard activity
- [ ] 3-minute idle threshold (configurable)
- [ ] When idle detected → start idle timer
- [ ] When activity resumes → stop idle timer, POST interval to backend
- [ ] Visual indicator when idle is being tracked

### 8.5 Productivity Panel
- [ ] Focus score display (current day/week)
- [ ] AI coaching tips panel
- [ ] Weekly productivity summary
- [ ] AI insights display

### Deliverables
- Desktop app with start/stop timer
- Automatic idle detection and reporting
- Focus score and AI coaching visible to employees

---

## Version 2 Features (Post-MVP)

### V2.1 AI Workload Forecasting
- [ ] Predict team capacity based on historical data
- [ ] Workload pressure alerts for managers
- [ ] Capacity planning recommendations

### V2.2 AI Productivity Assistant
- [ ] Chat interface for employees and managers
- [ ] Natural language queries ("How productive was I this week?")
- [ ] Query system analytics and return insights

### V2.3 Team Productivity Heatmaps
- [ ] Visual heatmap of team productivity by hour/day
- [ ] Identify team-wide productivity patterns
- [ ] Workload distribution visualization

---

## Database Schema Overview

```
users
├── id (PK)
├── email (unique)
├── firstName
├── lastName
├── password (hashed)
├── role (admin/employee)
├── hourlyRate (decimal)
├── shiftId (FK → shifts)
├── status (invited/active/deactivated)
├── invitationToken
├── invitationExpiry
├── createdAt
└── updatedAt

shifts
├── id (PK)
├── name
├── startTime (TIME)
├── endTime (TIME)
├── allowedDays (JSON)
├── createdAt
└── updatedAt

work_sessions
├── id (PK)
├── userId (FK → users)
├── startTime (DATETIME)
├── endTime (DATETIME)
├── totalDuration (INT, seconds)
├── idleDuration (INT, seconds)
├── activeDuration (INT, seconds)
├── status (active/completed)
└── createdAt

idle_intervals
├── id (PK)
├── sessionId (FK → work_sessions)
├── startTime (DATETIME)
├── endTime (DATETIME)
└── duration (INT, seconds)

daily_focus_scores
├── id (PK)
├── userId (FK → users)
├── date (DATE)
├── score (DECIMAL)
├── category (deep/good/moderate/low)
├── totalActiveTime (INT, seconds)
├── totalLoggedTime (INT, seconds)
└── idleInterruptions (INT)

kpi_definitions
├── id (PK)
├── role
├── metricName
├── description
└── unit

kpi_entries
├── id (PK)
├── userId (FK → users)
├── kpiDefinitionId (FK → kpi_definitions)
├── value (DECIMAL)
├── period (week/month)
└── periodStart (DATE)

weekly_reports
├── id (PK)
├── userId (FK → users)
├── weekStart (DATE)
├── weekEnd (DATE)
├── totalHoursWorked (DECIMAL)
├── activeHours (DECIMAL)
├── idleHours (DECIMAL)
├── focusScore (DECIMAL)
├── kpiSummary (JSON)
└── payableAmount (DECIMAL)

ai_insights
├── id (PK)
├── userId (FK → users)
├── type
├── insight (TEXT)
├── recommendation (TEXT)
└── generatedAt

ai_coaching_tips
├── id (PK)
├── userId (FK → users)
├── category (productivity/time_usage/workload)
├── observation (TEXT)
├── recommendation (TEXT)
└── generatedAt
```

---

## API Endpoints Summary

### Auth
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | /auth/login | Public | Login |
| POST | /auth/refresh | Public | Refresh token |
| POST | /auth/accept-invite | Public | Accept invitation & set password |

### Users
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | /users | Admin | Create user (sends invite) |
| GET | /users | Admin | List all users |
| GET | /users/:id | Admin | Get user details |
| PATCH | /users/:id | Admin | Update user |
| DELETE | /users/:id | Admin | Deactivate user |
| POST | /users/:id/resend-invite | Admin | Resend invitation email |

### Shifts
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | /shifts | Admin | Create shift |
| GET | /shifts | Admin | List shifts |
| PATCH | /shifts/:id | Admin | Update shift |
| DELETE | /shifts/:id | Admin | Delete shift |

### Time Tracking
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | /time-tracking/start | Employee | Start session |
| POST | /time-tracking/stop | Employee | Stop session |
| GET | /time-tracking/current | Employee | Get active session |
| GET | /time-tracking/sessions | Both | Session history |
| POST | /time-tracking/idle | Employee | Report idle interval |

### Payroll
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | /payroll/weekly | Admin | Weekly payroll |
| GET | /payroll/monthly | Admin | Monthly payroll |
| GET | /payroll/employee/:id | Admin | Individual payroll |
| GET | /payroll/summary | Admin | Payroll summary |

### Focus Score
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | /focus-score/me | Employee | Own focus score |
| GET | /focus-score/team | Admin | Team focus scores |

### KPIs
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | /kpis/definitions | Both | KPI definitions by role |
| POST | /kpis/entry | Admin | Submit KPI entry |
| GET | /kpis/employee/:id | Admin | Employee KPIs |
| GET | /kpis/team | Admin | Team KPI overview |

### Reports
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | /reports/weekly | Both | Weekly reports |
| GET | /reports/weekly/:id | Both | Specific report |
| GET | /reports/weekly/:id/csv | Both | Export CSV |
| GET | /reports/weekly/:id/pdf | Both | Export PDF |

### AI Insights & Coaching
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | /insights/me | Employee | Own insights |
| GET | /insights/team | Admin | Team insights |
| GET | /coaching/me | Employee | Own coaching tips |
| GET | /coaching/team | Admin | Team coaching |

---

## Build Priority

```
Phase 1 → Foundation & Auth          (start here)
Phase 2 → Shifts & User Management
Phase 3 → Time Tracking Core
Phase 4 → Payroll & Focus Score
Phase 5 → KPIs & Weekly Reports
Phase 6 → AI Insights & Coaching
Phase 7 → React Admin Dashboard
Phase 8 → Electron Desktop App
```

Each phase builds on the previous one. The backend (Phases 1-6) should be completed before starting the frontend apps (Phases 7-8).
