import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { Organization } from '../types';
import { organizationsApi } from '../api/organizations.api';

interface OrgContextType {
  org: Organization | null;
  loading: boolean;
  updateOrg: (data: Partial<Organization>) => Promise<void>;
  refreshOrg: () => Promise<void>;
}

const OrgContext = createContext<OrgContextType | undefined>(undefined);

export function OrgProvider({ children }: { children: ReactNode }) {
  const [org, setOrg] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchOrg = useCallback(async () => {
    try {
      const response = await organizationsApi.getCurrent();
      setOrg(response.data);
    } catch {
      setOrg(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const updateOrg = useCallback(async (data: Partial<Organization>) => {
    const response = await organizationsApi.updateCurrent(data);
    setOrg(response.data);
  }, []);

  const refreshOrg = useCallback(async () => {
    setLoading(true);
    await fetchOrg();
  }, [fetchOrg]);

  useEffect(() => {
    fetchOrg();
  }, [fetchOrg]);

  return (
    <OrgContext.Provider value={{ org, loading, updateOrg, refreshOrg }}>
      {children}
    </OrgContext.Provider>
  );
}

export function useOrg() {
  const context = useContext(OrgContext);
  if (context === undefined) {
    throw new Error('useOrg must be used within an OrgProvider');
  }
  return context;
}
