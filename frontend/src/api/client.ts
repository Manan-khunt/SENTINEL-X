import { getAccessToken } from '../stores/authStore';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';
const IS_DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true' || true;

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
      const err: ApiError = {
        status: res.status,
        message: errorData.message || `API Request failed with status ${res.status}`,
        code: errorData.code || 'HTTP_ERROR',
        details: errorData,
      };
      throw err;
    }

    return (await res.json()) as T;
  } catch (error: any) {
    // If backend is not running and demo mode is permitted, we don't throw raw crash
    if (IS_DEMO_MODE && (error.name === 'TypeError' || error.status === 404 || error.status === 502)) {
      // Handled cleanly by caller/mock layer
      throw {
        status: 503,
        message: 'Backend server not detected. Operating in synthetic demo mode.',
        code: 'DEMO_FALLBACK',
      };
    }
    throw error;
  }
}
