import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, theme } from 'antd';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './pages/Login';
import Home from './pages/Home';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div
        style={{
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0a0a0f',
          gap: 20,
        }}
      >
        {/* Pulse loading animation */}
        <div style={{ position: 'relative', width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #7c5cfc, #38efb3)',
              animation: 'breathe 2s ease-in-out infinite',
            }}
          />
          <div
            style={{
              position: 'absolute',
              width: 40,
              height: 40,
              borderRadius: '50%',
              border: '2px solid rgba(124, 92, 252, 0.3)',
              animation: 'ring-expand 2s ease-out infinite',
            }}
          />
          <div
            style={{
              position: 'absolute',
              width: 40,
              height: 40,
              borderRadius: '50%',
              border: '2px solid rgba(56, 239, 176, 0.2)',
              animation: 'ring-expand 2s ease-out infinite 0.6s',
            }}
          />
        </div>
        <span
          style={{
            background: 'linear-gradient(135deg, #7c5cfc 0%, #5b8def 50%, #38efb3 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            fontSize: 14,
            fontWeight: 500,
            fontFamily: 'Inter, sans-serif',
            letterSpacing: '0.05em',
          }}
        >
          Initializing Pulse...
        </span>
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
    return null;
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        }
      />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Home />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: '#7c5cfc',
          colorBgBase: '#0a0a0f',
          colorBgContainer: 'rgba(255, 255, 255, 0.04)',
          colorBgElevated: 'rgba(255, 255, 255, 0.06)',
          colorBorder: 'rgba(255, 255, 255, 0.08)',
          colorBorderSecondary: 'rgba(255, 255, 255, 0.05)',
          colorText: 'rgba(255, 255, 255, 0.92)',
          colorTextSecondary: 'rgba(255, 255, 255, 0.65)',
          colorTextTertiary: 'rgba(255, 255, 255, 0.4)',
          borderRadius: 12,
          fontSize: 13,
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          colorBgSpotlight: 'rgba(124, 92, 252, 0.15)',
        },
        components: {
          Card: {
            colorBgContainer: 'rgba(255, 255, 255, 0.04)',
            colorBorderSecondary: 'rgba(255, 255, 255, 0.06)',
            borderRadiusLG: 16,
            paddingLG: 24,
          },
          Button: {
            colorPrimaryHover: '#9178ff',
            borderRadius: 10,
            controlHeight: 42,
            fontWeight: 500,
          },
          Input: {
            colorBgContainer: 'rgba(255, 255, 255, 0.05)',
            colorBorder: 'rgba(255, 255, 255, 0.08)',
            activeBorderColor: '#7c5cfc',
            hoverBorderColor: 'rgba(124, 92, 252, 0.4)',
            activeShadow: '0 0 0 2px rgba(124, 92, 252, 0.15)',
            borderRadius: 10,
            controlHeight: 44,
          },
          Tag: {
            colorBgContainer: 'rgba(124, 92, 252, 0.12)',
            colorBorder: 'rgba(124, 92, 252, 0.2)',
            borderRadiusSM: 8,
          },
          Table: {
            colorBgContainer: 'transparent',
            headerBg: 'rgba(255, 255, 255, 0.03)',
            rowHoverBg: 'rgba(124, 92, 252, 0.06)',
            borderColor: 'rgba(255, 255, 255, 0.05)',
          },
          Modal: {
            contentBg: 'rgba(16, 16, 24, 0.95)',
            headerBg: 'transparent',
          },
          Select: {
            colorBgContainer: 'rgba(255, 255, 255, 0.05)',
            colorBorder: 'rgba(255, 255, 255, 0.08)',
            controlHeight: 44,
            borderRadius: 10,
            optionActiveBg: 'rgba(124, 92, 252, 0.12)',
          },
          Checkbox: {
            colorBgContainer: 'rgba(255, 255, 255, 0.05)',
            colorBorder: 'rgba(255, 255, 255, 0.15)',
          },
          Alert: {
            colorInfoBg: 'rgba(124, 92, 252, 0.08)',
            colorErrorBg: 'rgba(255, 77, 79, 0.08)',
          },
          Menu: {
            colorBgContainer: 'transparent',
            colorItemBgSelected: 'rgba(124, 92, 252, 0.12)',
            colorItemBgHover: 'rgba(124, 92, 252, 0.06)',
          },
        },
      }}
    >
      <AuthProvider>
        <HashRouter>
          <AppRoutes />
        </HashRouter>
      </AuthProvider>
    </ConfigProvider>
  );
}
