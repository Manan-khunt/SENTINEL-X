import { apiClient } from './client';
import { setInMemoryAccessToken } from '../stores/authStore';
import type { Role, User } from '../types';

export interface LoginResponse {
  token: string;
  user: User;
}

interface ServerTokenResponse {
  access_token: string;
  token_type: string;
}

interface ServerUserResponse {
  id: number;
  username: string;
  role: Role;
}

export const authApi = {
  login: async (username: string, password?: string): Promise<LoginResponse> => {
    try {
      // 1. Authenticate with backend /api/auth/login
      const tokenRes = await apiClient<ServerTokenResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password: password || '' }),
      });

      // 2. Temporarily set access token so subsequent /me request has Bearer header
      setInMemoryAccessToken(tokenRes.access_token);

      // 3. Obtain verified user profile and role from server
      const meRes = await apiClient<ServerUserResponse>('/me');

      return {
        token: tokenRes.access_token,
        user: {
          username: meRes.username,
          displayName: meRes.username.toUpperCase(),
          role: meRes.role,
        },
      };
    } catch (err: any) {
      // No synthetic login fallback - role always comes from server response
      setInMemoryAccessToken(null);
      throw err;
    }
  },

  getCurrentUser: async (): Promise<User> => {
    const meRes = await apiClient<ServerUserResponse>('/me');
    return {
      username: meRes.username,
      displayName: meRes.username.toUpperCase(),
      role: meRes.role,
    };
  },

  logout: async (): Promise<void> => {
    setInMemoryAccessToken(null);
    try {
      await apiClient('/auth/logout', { method: 'POST' });
    } catch {
      // Ignore
    }
  },
};
