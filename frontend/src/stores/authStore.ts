import { create } from 'zustand';
import type { Role, User } from '../types';
import { authApi } from '../api/auth';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password?: string) => Promise<boolean>;
  logout: () => void;
  setRole: (role: Role) => void;
}

// In-memory token storage only - STRICTLY NO localStorage or sessionStorage
let inMemoryAccessToken: string | null = null;

export const getAccessToken = (): string | null => inMemoryAccessToken;

export const setInMemoryAccessToken = (token: string | null): void => {
  inMemoryAccessToken = token;
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: false,

  login: async (username: string, password?: string) => {
    set({ isLoading: true });
    try {
      const res = await authApi.login(username, password);
      inMemoryAccessToken = res.token;

      set({
        user: res.user,
        token: res.token,
        isAuthenticated: true,
        isLoading: false,
      });
      return true;
    } catch (err) {
      inMemoryAccessToken = null;
      set({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
      });
      throw err;
    }
  },

  logout: () => {
    inMemoryAccessToken = null;
    authApi.logout().catch(() => {});
    set({
      user: null,
      token: null,
      isAuthenticated: false,
    });
  },

  setRole: (role: Role) => {
    set((state) => ({
      user: state.user ? { ...state.user, role } : null,
    }));
  },
}));
