import { create } from 'zustand';
import type { Role, User } from '../types';

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
let inMemoryAccessToken: string | null = 'sentinel_mem_tok_' + Math.random().toString(36).substring(2);

export const getAccessToken = (): string | null => inMemoryAccessToken;

export const useAuthStore = create<AuthState>((set) => ({
  user: {
    username: 'analyst_404',
    displayName: 'Lead Security Analyst',
    role: 'analyst',
  },
  token: inMemoryAccessToken,
  isAuthenticated: true,
  isLoading: false,

  login: async (username: string, _password?: string) => {
    set({ isLoading: true });
    // Simulate instantaneous SOC auth
    await new Promise((resolve) => setTimeout(resolve, 400));
    
    inMemoryAccessToken = 'sentinel_mem_tok_' + Math.random().toString(36).substring(2);
    const assignedRole: Role = username.toLowerCase().includes('admin') 
      ? 'admin' 
      : username.toLowerCase().includes('approv') 
      ? 'approver' 
      : 'analyst';

    set({
      user: {
        username,
        displayName: username.toUpperCase(),
        role: assignedRole,
      },
      token: inMemoryAccessToken,
      isAuthenticated: true,
      isLoading: false,
    });
    return true;
  },

  logout: () => {
    inMemoryAccessToken = null;
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
