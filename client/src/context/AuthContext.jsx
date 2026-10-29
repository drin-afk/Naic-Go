import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get('/auth/me');
      setUser(data.data.user);
      setUnread(data.data.unread_notifications || 0);
      return data.data.user;
    } catch {
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const login = async (identifier, password) => {
    const { data } = await api.post('/auth/login', { identifier, password });
    setUser(data.data.user);
    refresh();
    return data.data.user;
  };

  const register = async (kind, body) => {
    const { data } = await api.post(`/auth/register-${kind}`, body);
    setUser(data.data.user);
    return data.data.user;
  };

  const logout = async () => {
    try { await api.post('/auth/logout'); } finally { setUser(null); setUnread(0); }
  };

  const value = useMemo(() => ({ user, loading, unread, setUnread, login, logout, register, refresh }), [user, loading, unread, refresh]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

/** Where each role lands after logging in. */
export function homeFor(user) {
  if (!user) return '/';
  if (user.role === 'admin') return '/admin/dashboard';
  if (user.role === 'driver') return user.approval_status === 'approved' && user.status === 'active' ? '/driver/dashboard' : '/driver/pending';
  return '/commuter/dashboard';
}
