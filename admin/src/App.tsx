import { useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Spin } from 'antd';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { OrgProvider } from './contexts/OrgContext';
import ErrorBoundary from './components/ErrorBoundary';
import AdminLayout from './layouts/AdminLayout';
import LoginPage from './pages/Login';
import DashboardPage from './pages/Dashboard';
import UsersPage from './pages/Users';
import ShiftsPage from './pages/Shifts';
import TimeTrackingPage from './pages/TimeTracking';
import PayrollPage from './pages/Payroll';
import PayrollDetailPage from './pages/PayrollDetail';
import SessionHistoryDetailPage from './pages/SessionHistoryDetail';
import AiInsightsPage from './pages/AiInsights';
import PeerReviewsPage from './pages/PeerReviews';
import TeamsPage from './pages/Teams';
import LeaveRequestsPage from './pages/LeaveRequests';
import AnnouncementsPage from './pages/Announcements';
import OrganizationSettings from './pages/OrganizationSettings';
import SuperAdminDashboard from './pages/SuperAdminDashboard';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function PageErrorBoundary({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  return (
    <ErrorBoundary resetKey={location.pathname}>
      {children}
    </ErrorBoundary>
  );
}

function AppRoutes() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const handleAuthLogout = () => {
      logout();
      navigate('/login', { replace: true });
    };

    window.addEventListener('auth:logout', handleAuthLogout);
    return () => {
      window.removeEventListener('auth:logout', handleAuthLogout);
    };
  }, [logout, navigate]);

  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        }
      />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <OrgProvider>
              <AdminLayout />
            </OrgProvider>
          </ProtectedRoute>
        }
      >
        <Route index element={<PageErrorBoundary><DashboardPage /></PageErrorBoundary>} />
        <Route path="super-admin" element={<PageErrorBoundary><SuperAdminDashboard /></PageErrorBoundary>} />
        <Route path="users" element={<PageErrorBoundary><UsersPage /></PageErrorBoundary>} />
        <Route path="teams" element={<PageErrorBoundary><TeamsPage /></PageErrorBoundary>} />
        <Route path="shifts" element={<PageErrorBoundary><ShiftsPage /></PageErrorBoundary>} />
        <Route path="time-tracking" element={<PageErrorBoundary><TimeTrackingPage /></PageErrorBoundary>} />
        <Route path="time-tracking/sessions/:userId" element={<PageErrorBoundary><SessionHistoryDetailPage /></PageErrorBoundary>} />
        <Route path="payroll" element={<PageErrorBoundary><PayrollPage /></PageErrorBoundary>} />
        <Route path="payroll/:userId" element={<PageErrorBoundary><PayrollDetailPage /></PageErrorBoundary>} />
        <Route path="ai-insights" element={<PageErrorBoundary><AiInsightsPage /></PageErrorBoundary>} />
        <Route path="peer-reviews" element={<PageErrorBoundary><PeerReviewsPage /></PageErrorBoundary>} />
        <Route path="leave-requests" element={<PageErrorBoundary><LeaveRequestsPage /></PageErrorBoundary>} />
        <Route path="announcements" element={<PageErrorBoundary><AnnouncementsPage /></PageErrorBoundary>} />
        <Route path="settings" element={<PageErrorBoundary><OrganizationSettings /></PageErrorBoundary>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </ErrorBoundary>
  );
}
