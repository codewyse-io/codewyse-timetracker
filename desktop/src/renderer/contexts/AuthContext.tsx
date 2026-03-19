import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { User } from '../types';
import { login as apiLogin, getMe } from '../api/client';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  error: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isAuthenticated = !!user;

  const loadUser = useCallback(async () => {
    try {
      const token = await window.electronAPI.getAuthToken();
      if (token) {
        const userData = await getMe();
        setUser(userData.data || userData);
      }
    } catch {
      await window.electronAPI.clearAuthToken();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const login = useCallback(async (email: string, password: string) => {
    setError(null);
    try {
      const response = await apiLogin(email, password);
      const token = response.data?.accessToken || response.accessToken || response.token;
      if (token) {
        await window.electronAPI.setAuthToken(token);
      }
      const userData = response.data?.user || response.user;
      if (userData) {
        setUser(userData);
      } else {
        await loadUser();
      }
    } catch (err: any) {
      const message = err.response?.data?.message || err.message || 'Login failed';
      setError(message);
      throw new Error(message);
    }
  }, [loadUser]);

  const logout = useCallback(async () => {
    await window.electronAPI.clearAuthToken();
    setUser(null);
    setError(null);
  }, []);

  // Listen for auth-expired event from 401 interceptor
  useEffect(() => {
    const handleAuthExpired = () => {
      logout();
    };
    window.addEventListener('auth-expired', handleAuthExpired);
    return () => {
      window.removeEventListener('auth-expired', handleAuthExpired);
    };
  }, [logout]);

  const value = useMemo(() => ({
    user,
    isAuthenticated,
    isLoading,
    login,
    logout,
    error,
  }), [user, isAuthenticated, isLoading, login, logout, error]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
