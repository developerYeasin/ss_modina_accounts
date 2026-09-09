import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Auth } from '@/api/entities';
import { tokenStore, subscribeUnauthorized } from '@/api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const clearSession = useCallback(() => {
    tokenStore.clear();
    setUser(null);
  }, []);

  useEffect(() => subscribeUnauthorized(clearSession), [clearSession]);

  useEffect(() => {
    if (!tokenStore.get()) {
      setLoading(false);
      return;
    }
    Auth.me()
      .then(setUser)
      .catch(clearSession)
      .finally(() => setLoading(false));
  }, [clearSession]);

  const login = useCallback(async (email, password) => {
    const { token, user: u } = await Auth.login(email, password);
    tokenStore.set(token);
    setUser(u);
    return u;
  }, []);

  const register = useCallback(async (data) => {
    const { token, user: u } = await Auth.register(data);
    tokenStore.set(token);
    setUser(u);
    return u;
  }, []);

  const value = useMemo(() => ({
    user,
    loading,
    login,
    register,
    logout: clearSession,
    refresh: () => Auth.me().then(setUser),
    isAdmin: user?.role === 'admin',
    isManager: user?.role === 'admin' || user?.role === 'manager',
  }), [user, loading, login, register, clearSession]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
