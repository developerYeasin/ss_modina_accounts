import { createContext, useContext } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Setting, Branch } from '@/api/entities';

const SettingsContext = createContext(null);

const FALLBACK = {
  business_name: 'SS MODINA METAL & THAI GLASS',
  short_name: 'SS Modina হিসাব',
  subtitle: 'METAL & THAI GLASS',
  currency: '৳',
  order_prefix: 'SMTG',
  lunch_rate: 0,
};

/** Business settings + branches, loaded once and shared by every screen. */
export function SettingsProvider({ children }) {
  const settingQuery = useQuery({
    queryKey: ['setting'],
    queryFn: () => Setting.list(),
    staleTime: 5 * 60 * 1000,
  });
  const branchQuery = useQuery({
    queryKey: ['branches'],
    queryFn: () => Branch.filter({ active: true }, 'name'),
    staleTime: 5 * 60 * 1000,
  });

  const setting = settingQuery.data?.[0] || FALLBACK;

  const value = {
    setting,
    settingId: settingQuery.data?.[0]?.id || null,
    branches: branchQuery.data || [],
    currency: setting.currency || '৳',
    expenseCategories: (() => {
      try { return JSON.parse(setting.expense_categories || '[]'); } catch { return []; }
    })(),
    loading: settingQuery.isLoading,
    refetch: () => { settingQuery.refetch(); branchQuery.refetch(); },
  };

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used inside <SettingsProvider>');
  return ctx;
}
