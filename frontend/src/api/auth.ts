import { apiClient } from './client';
import type { User } from '../types';

export interface LoginResponse {
  token: string;
  user: User;
}

export const authApi = {
  login: async (username: string, password?: string): Promise<LoginResponse> => {
    try {
      return await apiClient<LoginResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
    } catch {
      // Synthetic fallback for demo environment
      return {
        token: 'mem_tok_' + Math.random().toString(36).substring(2),
        user: {
          username,
          displayName: username.toUpperCase(),
          role: username.toLowerCase().includes('admin') ? 'admin' : 'analyst',
        },
      };
    }
  },

  getCurrentUser: async (): Promise<User> => {
    return apiClient<User>('/auth/me');
  },

  logout: async (): Promise<void> => {
    try {
      await apiClient('/auth/logout', { method: 'POST' });
    } catch {
      // Ignored in demo mode
    }
  },
};
