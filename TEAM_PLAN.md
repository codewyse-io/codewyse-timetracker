# PulseTrack - Team Allocation & Sprint Plan

## Team Roster

| ID | Role | Focus Area |
|----|------|------------|
| BE-1 | Backend Developer | Auth, Users, Email, Security |
| BE-2 | Backend Developer | Time Tracking, Shifts, Payroll |
| BE-3 | Backend Developer | KPIs, Reports, AI Insights, BullMQ Workers |
| FE-1 | Senior Frontend Developer | Core setup, Auth, Dashboard, Users, Shifts |
| FE-2 | Senior Frontend Developer | Time Tracking, Payroll, KPIs, Reports, AI Insights |
| EL-1 | Senior Electron.js Developer | Desktop app — auth, timer, idle detection, productivity panel |

---

## Sprint Overview (2-week sprints)

```
Sprint 1 ──── Foundation & Auth (Backend) + Project Setup (Frontend/Electron)
Sprint 2 ──── Users, Shifts, Time Tracking Core
Sprint 3 ──── Payroll, Focus Score, KPIs
Sprint 4 ──── Reports, AI Insights, Coaching
Sprint 5 ──── Frontend Completion + Electron Idle Detection
Sprint 6 ──── Integration Testing, Bug Fixes, Polish
```

---

## Sprint 1: Foundation (Week 1-2)

### BE-1 — Auth & User Foundation
- [ ] Initialize NestJS project, configure TypeScript strict mode
- [ ] Set up MySQL + TypeORM connection and migration system
- [ ] Configure environment variables (.env schema)
- [ ] Set up global validation pipes (class-validator, class-transformer)
- [ ] Create User entity and migration
- [ ] Implement password hashing service (bcrypt)
- [ ] Build login endpoint (email + password → JWT access + refresh token)
- [ ] Build refresh token endpoint
- [ ] Implement JWT strategy and AuthGuard
- [ ] Implement RolesGuard (Admin / Employee)
- [ ] Write unit tests for auth service

### BE-2 — Shift & Config Foundation
- [ ] Create Shift entity and migration
- [ ] Create WorkSession entity and migration
- [ ] Create IdleInterval entity and migration
- [ ] Set up Redis connection for BullMQ
- [ ] Configure BullMQ module with base queue setup
- [ ] Set up Swagger/OpenAPI documentation
- [ ] Create shared DTOs and response interceptors
- [ ] Create database seeder for default admin user
- [ ] Write health check endpoint

### BE-3 — Email & Infrastructure
- [ ] Set up email module (SendGrid / SES / SMTP)
- [ ] Create invitation email template (HTML)
- [ ] Create weekly report email template (HTML)
- [ ] Create password reset email template (HTML)
- [ ] Set up logging module (Winston / Pino)
- [ ] Configure CORS and rate limiting
- [ ] Set up error handling filters (global exception filter)
- [ ] Create base repository patterns and pagination utility
- [ ] Write integration test setup (test database config)

### FE-1 — Admin App Setup
- [ ] Initialize React project with TypeScript (Vite)
- [ ] Set up folder structure (pages, components, hooks, services, types)
- [ ] Configure routing (React Router v6)
- [ ] Set up UI component library (Ant Design / Shadcn + Tailwind)
- [ ] Build API client (Axios instance with interceptors)
- [ ] Implement auth context (JWT storage, refresh logic, auto-logout)
- [ ] Build Login page
- [ ] Build app shell layout (sidebar, header, breadcrumbs)
- [ ] Set up protected route wrapper

### FE-2 — Design System & Shared Components
- [ ] Build shared table component (sortable, filterable, paginated)
- [ ] Build shared form components (input, select, date picker, time picker)
- [ ] Build shared modal component (confirm, form modal)
- [ ] Build notification/toast system
- [ ] Build stats card component
- [ ] Build chart components (line, bar, donut) using Recharts/Chart.js
- [ ] Build empty state and loading skeleton components
- [ ] Build CSV/PDF export utility functions
- [ ] Create TypeScript types for all API responses

### EL-1 — Electron App Setup
- [ ] Initialize Electron + React project (electron-vite / electron-forge)
- [ ] Configure build pipeline (Windows + macOS)
- [ ] Set up auto-updater (electron-updater)
- [ ] Configure system tray integration (icon, context menu)
- [ ] Set up secure token storage (electron-store / keytar)
- [ ] Build login screen
- [ ] Implement JWT auth flow (login, token refresh, auto-login)
- [ ] Build main window layout (compact timer view)
- [ ] Set up IPC communication between main and renderer process

### Sprint 1 Dependencies
```
BE-1 (Auth) ← FE-1 (Login page needs auth API)
BE-1 (Auth) ← EL-1 (Login screen needs auth API)
BE-2 (Entities) ← BE-1 (User entity needed first)
```

### Sprint 1 Deliverables
- Backend API running with auth endpoints
- Admin app with login and shell layout
- Electron app with login and system tray
- Email service configured and tested
- All database entities created

---

## Sprint 2: Core Features (Week 3-4)

### BE-1 — User Management & Invitations
- [ ] Build POST /users — Admin creates user (validates email uniqueness)
- [ ] Generate invitation token on user creation
- [ ] Trigger invitation email via email service
- [ ] Build POST /auth/accept-invite — Employee sets password, activates account
- [ ] Build POST /users/:id/resend-invite — Resend invitation
- [ ] Build GET /users — List users (paginated, filterable by role/status)
- [ ] Build GET /users/:id — Get user details with shift info
- [ ] Build PATCH /users/:id — Update user (role, hourlyRate, shiftId, status)
- [ ] Build DELETE /users/:id — Soft deactivate user
- [ ] Build GET /users/me — Current user profile
- [ ] Write unit + integration tests for user module

### BE-2 — Shift Management & Time Tracking
- [ ] Build POST /shifts — Create shift (admin)
- [ ] Build GET /shifts — List all shifts
- [ ] Build PATCH /shifts/:id — Update shift
- [ ] Build DELETE /shifts/:id — Soft delete (block if users assigned)
- [ ] Implement shift validation service (`isWithinShift(userId)`)
- [ ] Build POST /time-tracking/start — Start session (enforce shift)
- [ ] Build POST /time-tracking/stop — Stop session (calculate durations)
- [ ] Build GET /time-tracking/current — Get active session
- [ ] Build GET /time-tracking/sessions — Session history (date range, userId filter)
- [ ] Build POST /time-tracking/idle — Report idle interval from Electron
- [ ] Duration calculations: total, idle, active
- [ ] Write unit + integration tests for time tracking module

### BE-3 — Focus Score & Background Jobs
- [ ] Create DailyFocusScore entity and migration
- [ ] Implement focus score calculation service
  - Formula: `(activeTime / totalLoggedTime) × 100`
  - Penalty: -2 points per idle interruption above 5 per day
- [ ] Categorize scores (Deep/Good/Moderate/Low)
- [ ] Build BullMQ job: Calculate daily focus scores (end of day cron)
- [ ] Build GET /focus-score/me — Employee's daily/weekly score
- [ ] Build GET /focus-score/team — Team scores (admin)
- [ ] Create configurable settings table (idle threshold, score penalties)
- [ ] Build GET /settings and PATCH /settings endpoints (admin)
- [ ] Write unit tests for focus score calculations

### FE-1 — Users & Shifts Pages
- [ ] Build Users list page (table with search, role filter, status filter)
- [ ] Build Add User modal (email, firstName, lastName, role, hourlyRate, shift select)
- [ ] Build Edit User modal (update role, rate, shift, status)
- [ ] Build User detail page (profile info, assigned shift, status)
- [ ] Build Deactivate user confirmation flow
- [ ] Build Shifts list page (table with shift details)
- [ ] Build Add/Edit Shift modal (name, start time, end time, day checkboxes)
- [ ] Build Delete Shift confirmation (show warning if users assigned)
- [ ] Connect all pages to backend APIs

### FE-2 — Time Tracking & Dashboard
- [ ] Build Dashboard page — overview stats:
  - Total employees, active sessions now, avg focus score today
  - Weekly hours chart (bar chart by day)
  - Team focus score distribution (donut chart)
- [ ] Build Time Tracking page
  - Active sessions table (real-time, who's working now)
  - Session history table (date range picker, user filter)
  - Session detail view (timeline with idle intervals highlighted)
- [ ] Build auto-refresh for active sessions (polling or WebSocket)
- [ ] Connect all components to backend APIs

### EL-1 — Timer & Basic Idle Detection
- [ ] Build Start/Stop timer UI (large button, elapsed time counter)
- [ ] Connect to POST /time-tracking/start and /stop APIs
- [ ] Display assigned shift info (hours, days)
- [ ] Handle shift enforcement errors (show message if outside shift)
- [ ] Show session history (today's sessions list)
- [ ] Implement basic idle detection using `powerMonitor.getSystemIdleTime()`
- [ ] Set 3-minute idle threshold
- [ ] When idle detected → start tracking idle interval locally
- [ ] When activity resumes → POST idle interval to backend
- [ ] Show idle status indicator in UI

### Sprint 2 Dependencies
```
BE-1 (Users API) ← FE-1 (Users page)
BE-2 (Shifts API) ← FE-1 (Shifts page)
BE-2 (Time Tracking API) ← FE-2 (Time Tracking page)
BE-2 (Time Tracking API) ← EL-1 (Timer + idle reporting)
BE-3 (Focus Score API) ← FE-2 (Dashboard)
```

### Sprint 2 Deliverables
- Full user management with email invitations
- Shift management with enforcement
- Time tracking start/stop with idle reporting
- Focus score calculation
- Admin dashboard with live team stats
- Electron timer with idle detection working

---

## Sprint 3: Payroll, KPIs (Week 5-6)

### BE-1 — Payroll System
- [ ] Create payroll calculation service
  - `payableAmount = activeHours × hourlyRate`
- [ ] Build weekly payroll aggregation query (group by user, sum active hours)
- [ ] Build monthly payroll aggregation query
- [ ] Build GET /payroll/weekly?weekStart=YYYY-MM-DD — Weekly payroll (admin)
- [ ] Build GET /payroll/monthly?month=YYYY-MM — Monthly payroll (admin)
- [ ] Build GET /payroll/employee/:id?period=week|month — Individual payroll
- [ ] Build GET /payroll/summary — Total payroll for given period
- [ ] Handle edge cases: mid-week joins, deactivated users, zero hours
- [ ] Write unit tests for payroll calculations
- [ ] Build payroll CSV export endpoint

### BE-2 — KPI Framework
- [ ] Create KpiDefinition entity and migration
- [ ] Create KpiEntry entity and migration
- [ ] Build database seeder for role-specific KPI definitions:
  - Project Manager: Sprint completion rate, Task delivery rate, Blocker resolution time, Milestone adherence
  - Product Manager: PRDs written, Feature releases, Roadmap adherence, Stakeholder satisfaction
  - Backend Developer: PRs merged, Bugs fixed, API performance, Deployment success rate
  - Frontend Developer: UI features delivered, Bug resolution time, Performance score, Code reviews
  - Mobile Developer: Builds released, Crash rate, Feature completion rate
  - QA: Bugs detected, Test coverage, Regression tests executed, Bug escape rate
  - HR: Hiring cycle time, Candidate pipeline, Retention rate, Employee satisfaction
- [ ] Build GET /kpis/definitions?role=xxx — List KPI definitions
- [ ] Build POST /kpis/entry — Submit KPI entry (admin)
- [ ] Build POST /kpis/entries/bulk — Bulk submit KPI entries
- [ ] Build GET /kpis/employee/:id?period=week — Employee KPIs
- [ ] Build GET /kpis/team?period=week — Team KPI overview
- [ ] Write unit tests for KPI module

### BE-3 — Weekly Report Generation
- [ ] Create WeeklyReport entity and migration
- [ ] Build report generation service:
  - Aggregate: totalHoursWorked, activeHours, idleHours per user per week
  - Include: focusScore (avg for week), kpiSummary (JSON), payableAmount
- [ ] Build BullMQ cron job: Generate weekly reports every Sunday 11:59 PM
- [ ] Build GET /reports/weekly?page=1&limit=10 — List reports (paginated)
- [ ] Build GET /reports/weekly/:id — Get specific report details
- [ ] Build GET /reports/weekly/export/csv?weekStart=YYYY-MM-DD — CSV export
- [ ] Build GET /reports/weekly/export/pdf?weekStart=YYYY-MM-DD — PDF export (pdfkit)
- [ ] Build BullMQ job: Email weekly reports to all admins
- [ ] Write unit tests for report generation

### FE-1 — Payroll & KPI Pages
- [ ] Build Payroll page
  - Weekly view: table with employee, active hours, rate, payable amount
  - Monthly view: toggle between weekly/monthly
  - Total payroll summary card at top
  - Week/month selector
  - Export CSV button
- [ ] Build KPI Management page
  - KPI definitions list (grouped by role)
  - Add KPI entry form (select employee → shows role KPIs → enter values)
  - Bulk entry mode (enter KPIs for whole team at once)
- [ ] Connect to payroll and KPI APIs

### FE-2 — Reports & KPI Dashboard
- [ ] Build Reports page
  - Weekly reports table (week selector, employee filter)
  - Report detail view (all metrics for one employee for one week)
  - Download CSV / PDF buttons
- [ ] Build KPI Dashboard
  - Team KPI overview cards (avg per metric)
  - Individual KPI trend charts (line chart over weeks)
  - Role-based KPI comparison view
  - KPI performance indicators (above/below target)
- [ ] Enhance Dashboard page with payroll summary widget
- [ ] Connect to reports and KPI APIs

### EL-1 — Productivity Panel & Polish
- [ ] Build productivity panel in Electron app
  - Today's focus score (large number + category label)
  - Weekly focus score trend (mini line chart)
  - Active time vs idle time breakdown (progress bar)
- [ ] Build session summary view
  - Today: total time, active time, idle time, sessions count
  - This week: same metrics aggregated
- [ ] Add desktop notifications
  - Shift start reminder (5 min before)
  - Shift end reminder
  - Idle resumed notification
- [ ] Improve idle detection accuracy
  - Combine powerMonitor with custom mouse/keyboard hooks if needed
  - Handle sleep/wake events properly
  - Handle multiple monitors
- [ ] Add minimize to tray behavior
- [ ] Add "Start with Windows/macOS" option

### Sprint 3 Dependencies
```
BE-1 (Payroll API) ← FE-1 (Payroll page)
BE-2 (KPI API) ← FE-1 (KPI Management), FE-2 (KPI Dashboard)
BE-3 (Reports API) ← FE-2 (Reports page)
BE-3 (Focus Score) ← EL-1 (Productivity panel)
```

### Sprint 3 Deliverables
- Payroll calculation and export
- Full KPI framework with role-specific metrics
- Automated weekly report generation
- PDF/CSV export
- Electron productivity panel with notifications

---

## Sprint 4: AI Features (Week 7-8)

### BE-1 — AI Service Integration
- [ ] Set up AI provider module (Claude API / OpenAI)
- [ ] Create AI prompt templates:
  - Productivity insight prompt (input: session data, focus scores, patterns)
  - Coaching recommendation prompt (input: individual trends, idle patterns)
  - Team overview prompt (input: aggregated team data)
- [ ] Create AiInsight entity and migration
- [ ] Create AiCoachingTip entity and migration
- [ ] Build AI data aggregation service (prepare data for AI prompts)
- [ ] Implement rate limiting and cost tracking for AI calls
- [ ] Write unit tests with mocked AI responses

### BE-2 — AI Insight & Coaching Endpoints
- [ ] Build BullMQ worker: Weekly insight generation
  - For each employee: analyze patterns → generate insight + recommendation
  - For team: aggregate analysis → generate team insights
- [ ] Build BullMQ worker: Weekly coaching tip generation
  - Productivity coaching (session length, focus patterns)
  - Time usage coaching (idle patterns, peak hours)
  - Workload coaching (overtime detection, capacity alerts)
- [ ] Build GET /insights/me — Employee's own insights (paginated)
- [ ] Build GET /insights/team — Team insights (admin, paginated)
- [ ] Build GET /coaching/me — Employee's coaching tips
- [ ] Build GET /coaching/team — Team coaching overview (admin)
- [ ] Build POST /insights/generate — Manually trigger insight generation (admin)
- [ ] Write integration tests for AI workers

### BE-3 — Polish & Optimization
- [ ] Add database indexes for performance (userId + date queries)
- [ ] Implement query caching (Redis) for dashboard aggregations
- [ ] Add request logging middleware
- [ ] Implement API versioning (v1 prefix)
- [ ] Security audit: SQL injection, rate limiting, input sanitization
- [ ] Add Swagger documentation for all endpoints
- [ ] Write missing integration tests
- [ ] Performance test time tracking endpoints under load
- [ ] Create Docker Compose setup (API + MySQL + Redis)

### FE-1 — AI Insights Page & Final Polish
- [ ] Build AI Insights page
  - Team insights overview (cards with insight + recommendation)
  - Individual employee insights (select employee → see their insights)
  - Insight type filters (productivity, time usage, patterns)
- [ ] Build Coaching Overview page
  - Team coaching summary
  - Individual coaching tips (categorized by type)
- [ ] Add loading states to all pages
- [ ] Add error boundaries and error pages (404, 500)
- [ ] Responsive design pass (tablet + large screens)
- [ ] Accessibility audit (keyboard nav, screen reader, contrast)

### FE-2 — Dashboard Enhancements & Final Polish
- [ ] Enhance Dashboard with:
  - AI insight highlight card (latest team insight)
  - Focus score trend chart (team avg over weeks)
  - Productivity heatmap (hours × days grid)
  - Quick actions (add user, view reports, generate insights)
- [ ] Build user profile page (employee self-view)
- [ ] Implement dark mode toggle
- [ ] Add data refresh indicators (last updated timestamps)
- [ ] Cross-browser testing (Chrome, Firefox, Edge, Safari)
- [ ] Performance optimization (lazy loading, code splitting)

### EL-1 — AI Coaching Panel & Final Polish
- [ ] Build AI Coaching panel in Electron app
  - Latest coaching tips (categorized cards)
  - Productivity insight summary
  - "How to improve" section based on coaching
- [ ] Build weekly summary view
  - Comparison with previous week (up/down arrows)
  - Focus score trend
  - Best productivity day highlight
- [ ] Add offline support
  - Queue idle intervals when offline
  - Sync when connection restored
  - Show offline indicator
- [ ] Add keyboard shortcuts (start/stop timer)
- [ ] Polish animations and transitions
- [ ] Memory leak testing and optimization
- [ ] Windows + macOS build testing

### Sprint 4 Dependencies
```
BE-1 (AI Service) ← BE-2 (AI Workers need AI service)
BE-2 (AI Endpoints) ← FE-1 (AI Insights page)
BE-2 (AI Endpoints) ← EL-1 (AI Coaching panel)
```

### Sprint 4 Deliverables
- AI insight generation working
- AI coaching recommendations
- Admin AI dashboard
- Electron AI coaching panel
- Docker deployment ready

---

## Sprint 5: Integration & Hardening (Week 9-10)

### BE-1 — Security & Edge Cases
- [ ] Implement account lockout after failed login attempts
- [ ] Add refresh token rotation (invalidate old tokens)
- [ ] Audit all endpoints for proper authorization
- [ ] Add request body size limits
- [ ] Implement CSRF protection for admin app
- [ ] Test concurrent session start/stop edge cases
- [ ] Handle timezone differences across team members
- [ ] Add admin activity audit log

### BE-2 — Performance & Monitoring
- [ ] Load test all critical endpoints
- [ ] Optimize slow database queries (EXPLAIN analysis)
- [ ] Add health check endpoint with DB + Redis status
- [ ] Set up application monitoring hooks (ready for Datadog/Sentry)
- [ ] Implement graceful shutdown
- [ ] Test BullMQ job failure and retry scenarios
- [ ] Document all environment variables

### BE-3 — Deployment & Documentation
- [ ] Finalize Docker Compose for production
- [ ] Create deployment guide (AWS / self-hosted)
- [ ] Write API documentation (Postman collection export)
- [ ] Create database backup strategy documentation
- [ ] Write runbook for common operations (reset password, regenerate reports)

### FE-1 + FE-2 — Integration Testing & Polish
- [ ] End-to-end testing of all user flows
- [ ] Fix UI bugs from QA testing
- [ ] Performance optimization (bundle size audit)
- [ ] Finalize responsive design
- [ ] Add helpful empty states and onboarding hints
- [ ] Cross-browser compatibility fixes

### EL-1 — Platform Testing & Distribution
- [ ] Test on Windows 10, Windows 11
- [ ] Test on macOS (Intel + Apple Silicon)
- [ ] Set up auto-update server
- [ ] Create installer packages (NSIS for Windows, DMG for macOS)
- [ ] Test idle detection accuracy across platforms
- [ ] Fix platform-specific bugs
- [ ] Code signing setup (Windows + macOS)

### Sprint 5 Deliverables
- Production-ready backend
- Polished admin dashboard
- Distributable Electron app (Windows + macOS)
- Full documentation

---

## Sprint 6: QA & Launch (Week 11-12)

### All Team Members
- [ ] Full regression testing
- [ ] Bug fix sprint (priority: critical → high → medium)
- [ ] User acceptance testing with real team members
- [ ] Performance benchmarking
- [ ] Security penetration testing
- [ ] Final deployment to production
- [ ] Team onboarding and training
- [ ] Monitor first week of usage
- [ ] Collect feedback and create V1.1 backlog

---

## Parallel Work Visualization

```
Week  1-2  │  3-4  │  5-6  │  7-8  │  9-10  │ 11-12
──────────────────────────────────────────────────────

BE-1  [Auth & Setup     ][Users & Invites  ][Payroll Calc     ][AI Service       ][Security Harden  ][QA & Bugs  ]
BE-2  [Entities & Infra ][Shifts & Timer   ][KPI Framework    ][AI Endpoints     ][Perf & Monitor   ][QA & Bugs  ]
BE-3  [Email & Logging  ][Focus Score      ][Reports & Export ][Polish & Docker  ][Deploy & Docs    ][QA & Bugs  ]
FE-1  [React Setup      ][Users & Shifts   ][Payroll & KPI    ][AI Insights Page ][Integration Test ][QA & Bugs  ]
FE-2  [Design System    ][Dashboard & Time ][Reports & KPI    ][Dashboard Polish ][Integration Test ][QA & Bugs  ]
EL-1  [Electron Setup   ][Timer & Idle     ][Productivity UI  ][AI Coaching      ][Platform Testing ][QA & Bugs  ]
```

---

## Communication & Processes

### Daily Standups
- 15-minute standup at start of shift
- Each dev: what I did, what I'm doing, any blockers

### Code Review Policy
- All PRs require at least 1 approval
- Backend PRs: reviewed by another backend dev
- Frontend PRs: reviewed by the other frontend dev
- Electron PRs: reviewed by a frontend dev (closest expertise)

### Branch Strategy
```
main ─── stable, production-ready
  └── develop ─── integration branch
        ├── feature/BE-auth
        ├── feature/BE-time-tracking
        ├── feature/FE-dashboard
        ├── feature/EL-timer
        └── ...
```

### Definition of Done
- [ ] Code written and self-reviewed
- [ ] Unit tests passing
- [ ] PR created and approved
- [ ] Merged to develop
- [ ] Swagger docs updated (backend)
- [ ] No TypeScript errors
- [ ] Tested on target platform (Electron)

### Key Integration Points
| Producer | Consumer | Contract |
|----------|----------|----------|
| BE-1 (Auth API) | FE-1 (Login), EL-1 (Login) | JWT tokens, /auth/* endpoints |
| BE-2 (Time Tracking API) | EL-1 (Timer), FE-2 (Dashboard) | /time-tracking/* endpoints |
| BE-2 (Shift API) | EL-1 (Shift check), FE-1 (Shift page) | /shifts/* endpoints |
| BE-1 (Payroll API) | FE-1 (Payroll page) | /payroll/* endpoints |
| BE-3 (Reports API) | FE-2 (Reports page) | /reports/* endpoints |
| BE-2 (AI Endpoints) | FE-1 (Insights page), EL-1 (Coaching) | /insights/*, /coaching/* |

### Risk Mitigation
| Risk | Mitigation |
|------|------------|
| Idle detection inaccuracy | EL-1 starts early, iterates on detection logic across Sprint 2-3 |
| AI costs unpredictable | BE-1 implements rate limiting and cost tracking from day 1 |
| Cross-platform Electron bugs | EL-1 tests on both OS from Sprint 1, not just at the end |
| Frontend-backend contract mismatch | Swagger docs as source of truth, shared TypeScript types |
| BullMQ job failures | BE-3 implements retry logic and dead letter queues early |
