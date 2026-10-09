// Backend-backed auth. Token lives in memory only (never localStorage).
// Role always comes from GET /api/me — never hardcoded or switchable in UI.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, onUnauthorized, setTokenGetter } from './api';
import type { User } from './types';

interface AuthCtx {
  user: User | null;
  token: string | null;
  ready: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const Ctx = createContext<AuthCtx>({
  user: null,
  token: null,
  ready: false,
  login: async () => {},
  logout: () => {},
});

let memoryToken: string | null = null;
setTokenGetter(() => memoryToken);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);

  const login = useCallback(async (username: string, password: string) => {
    const res = await api.login(username, password);
    memoryToken = res.access_token;
    setToken(res.access_token);
    const me = await api.me();
    setUser(me);
  }, []);

  const logout = useCallback(() => {
    memoryToken = null;
    setToken(null);
    setUser(null);
  }, []);

  // Any 401 from the API layer clears the session; Shell redirects to /login.
  useEffect(() => {
    onUnauthorized(() => {
      memoryToken = null;
      setToken(null);
      setUser(null);
    });
    return () => onUnauthorized(null);
  }, []);

  const value = useMemo(
    () => ({ user, token, ready: true, login, logout }),
    [user, token, login, logout],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  return useContext(Ctx);
}

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) return null;
  return <>{children}</>;
}
