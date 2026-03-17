import { useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Spin } from 'antd';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ErrorBoundary from './components/ErrorBoundary';
import AdminLayout from './layouts/AdminLayout';
import LoginPage from './pages/Login';
import DashboardPage from './pages/Dashboard';
import UsersPage from './pages/Users';
import ShiftsPage from './pages/Shifts';
import TimeTrackingPage from './pages/TimeTracking';
import PayrollPage from './pages/Payroll';
import KpisPage from './pages/Kpis';
import ReportsPage from './pages/Reports';
import AiInsightsPage from './pages/AiInsights';
import LeaveRequestsPage from './pages/LeaveRequests';
import AnnouncementsPage from './pages/Announcements';

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
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<PageErrorBoundary><DashboardPage /></PageErrorBoundary>} />
        <Route path="users" element={<PageErrorBoundary><UsersPage /></PageErrorBoundary>} />
        <Route path="shifts" element={<PageErrorBoundary><ShiftsPage /></PageErrorBoundary>} />
        <Route path="time-tracking" element={<PageErrorBoundary><TimeTrackingPage /></PageErrorBoundary>} />
        <Route path="payroll" element={<PageErrorBoundary><PayrollPage /></PageErrorBoundary>} />
        <Route path="kpis" element={<PageErrorBoundary><KpisPage /></PageErrorBoundary>} />
        <Route path="reports" element={<PageErrorBoundary><ReportsPage /></PageErrorBoundary>} />
        <Route path="ai-insights" element={<PageErrorBoundary><AiInsightsPage /></PageErrorBoundary>} />
        <Route path="leave-requests" element={<PageErrorBoundary><LeaveRequestsPage /></PageErrorBoundary>} />
        <Route path="announcements" element={<PageErrorBoundary><AnnouncementsPage /></PageErrorBoundary>} />
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
