import { getAccessToken } from '../stores/authStore';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';
export const IS_DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true';

export interface ApiError {
  status: number;
  message: string;
  code?: string;
  details?: Record<string, unknown>;
}

export async function apiClient<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAccessToken();
  const headers = new Headers(options.headers || {});
  
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const url = `${API_BASE_URL.replace(/\/$/, '')}/${endpoint.replace(/^\//, '')}`;

  try {
    const res = await fetch(url, {
      ...options,
      headers,
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      const detailMsg = typeof errorData.detail === 'string' 
        ? errorData.detail 
        : errorData.message || `Request failed (${res.status})`;
      const err: ApiError = {
        status: res.status,
        message: detailMsg,
        code: errorData.code || `HTTP_${res.status}`,
        details: errorData,
      };
      throw err;
    }

    return (await res.json()) as T;
  } catch (error: any) {
    if (error.status && error.message) {
      throw error;
    }
    // Network / connection failure
    if (IS_DEMO_MODE) {
      throw {
        status: 503,
        message: 'Backend server not detected. Operating in synthetic demo mode.',
        code: 'DEMO_FALLBACK',
      };
    }
    throw {
      status: 0,
      message: 'Failed to connect to backend server at ' + url,
      code: 'NETWORK_ERROR',
      details: error,
    };
  }
}
