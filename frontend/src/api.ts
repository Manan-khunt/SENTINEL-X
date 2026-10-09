// ONE centralized API client for the FastAPI backend.
// Endpoint paths mirror the live OpenAPI spec exactly. No mock fallbacks:
// failures propagate so the UI shows real error states.
import type {
  ActionItem,
  ActionProof,
  AuditDetail,
  AuditRecord,
  AuditVerify,
  BenchmarkBatch,
  Configuration,
  GraphSnapshot,
  Health,
  Incident,
  LiveEvent,
  Mode,
  PathsResponse,
  Replay,
  Scenario,
  Timeline,
  User,
} from './types';

export const API_BASE = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');

let tokenGetter: () => string | null = () => null;
export function setTokenGetter(fn: () => string | null) {
  tokenGetter = fn;
}

// Global 401 hook: the auth provider registers session cleanup here so an
// expired/invalid token returns the UI to the login screen instead of
// failing silently with stale state.
let unauthorizedHandler: (() => void) | null = null;
export function onUnauthorized(fn: (() => void) | null) {
  unauthorizedHandler = fn;
}

export interface ApiError {
  status: number;
  message: string;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers || {});
  if (!headers.has('Content-Type') && init.body !== undefined) {
    headers.set('Content-Type', 'application/json');
  }
  const token = tokenGetter();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  } catch {
    throw { status: 0, message: `Backend unreachable at ${API_BASE}${path}` } as ApiError;
  }
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      if (typeof data?.detail === 'string') message = data.detail;
    } catch {
      /* keep default */
    }
    if (res.status === 401) {
      message = `Authentication required: ${message}`;
      unauthorizedHandler?.();
    } else if (res.status === 403) {
      message = `Not authorized: ${message}`;
    }
    throw { status: res.status, message } as ApiError;
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  login(username: string, password: string) {
    return request<{ access_token: string; token_type: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  },
  me() {
    return request<User>('/me');
  },
  health() {
    return request<Health>('/health');
  },
  scenarios() {
    return request<Scenario[]>('/scenarios');
  },

  createIncident(body: {
    scenario_id: string;
    seed: number;
    mode: Mode;
    configuration: Configuration;
  }) {
    return request<Incident>('/incidents', { method: 'POST', body: JSON.stringify(body) });
  },
  listIncidents() {
    return request<Incident[]>('/incidents');
  },
  getIncident(id: string) {
    return request<Incident>(`/incidents/${id}`);
  },
  stepIncident(id: string) {
    return request<Incident>(`/incidents/${id}/step`, { method: 'POST' });
  },
  getGraph(id: string) {
    return request<GraphSnapshot>(`/incidents/${id}/graph`);
  },
  getPaths(id: string) {
    return request<PathsResponse>(`/incidents/${id}/paths`);
  },
  getTimeline(id: string) {
    return request<Timeline>(`/incidents/${id}/timeline`);
  },
  getActions(id: string) {
    return request<ActionItem[]>(`/incidents/${id}/actions`);
  },
  getProof(incidentId: string, actionId: string) {
    return request<ActionProof>(`/incidents/${incidentId}/proof/${actionId}`);
  },
  getReplay(id: string) {
    return request<Replay>(`/incidents/${id}/replay`);
  },

  approve(actionId: string) {
    return request<{ status: string; action: string }>(`/actions/${actionId}/approve`, {
      method: 'POST',
    });
  },
  deny(actionId: string, reason?: string) {
    return request<{ status: string; action: string }>(`/actions/${actionId}/deny`, {
      method: 'POST',
      body: JSON.stringify({ reason: reason || '' }),
    });
  },
  undo(actionId: string) {
    return request<{ status: string; action: string }>(`/actions/${actionId}/undo`, {
      method: 'POST',
    });
  },

  auditList() {
    return request<AuditRecord[]>('/audit');
  },
  auditOne(id: string) {
    return request<AuditDetail>(`/audit/${id}`);
  },
  auditVerify(incidentId?: string) {
    const q = incidentId ? `?incident_id=${encodeURIComponent(incidentId)}` : '';
    return request<AuditVerify>(`/audit/verify${q}`);
  },

  benchmarks() {
    return request<BenchmarkBatch[]>('/benchmark');
  },
  runBenchmark() {
    return request<{ batch_id: string; status: string }>('/benchmark/run', { method: 'POST' });
  },

  systemStatus() {
    return request<{ status: string; version: string }>('/system/status');
  },
  systemMode() {
    return request<{ mode: string }>('/system/mode');
  },
  setSystemMode(mode: string) {
    return request<{ mode: string }>('/system/mode', {
      method: 'POST',
      body: JSON.stringify({ mode }),
    });
  },
  killSwitch() {
    return request<{ status: string }>('/system/kill-switch', { method: 'POST' });
  },
  resumeSystem() {
    return request<{ status: string }>('/system/resume', { method: 'POST' });
  },

  streamTicket() {
    return request<{ ticket: string; expires_at: string }>('/stream/ticket', {
      method: 'POST',
    });
  },
};

/** Connect to the backend SSE stream for one incident. Returns a cleanup fn.
 * The server replays buffered history on every connect, so callers must
 * dedupe using the SSE event id passed as the second onEvent argument. */
export function connectIncidentStream(
  incidentId: string,
  ticket: string,
  onEvent: (e: LiveEvent, eventId?: string) => void,
  onError?: () => void,
): () => void {
  const url = `${API_BASE}/stream/incidents/${encodeURIComponent(
    incidentId,
  )}?ticket=${encodeURIComponent(ticket)}`;
  const es = new EventSource(url);
  const forward = (type: string) => (e: MessageEvent) => {
    let data: unknown = e.data;
    try {
      data = JSON.parse(e.data);
    } catch {
      /* keep raw string */
    }
    onEvent({ type, data, at: new Date().toISOString() }, e.lastEventId || undefined);
  };
  // Generic handler catches every event; named handlers ensure typed delivery.
  es.onmessage = forward('message');
  const names = [
    'incident.started',
    'agent.step',
    'plan.created',
    'dry_run.completed',
    'risk.scored',
    'policy.checked',
    'action.proposed',
    'approval.required',
    'action.approved',
    'action.denied',
    'action.executed',
    'verification.completed',
    'adversary.action',
    'graph.updated',
    'graph.diff',
    'incident.replanned',
    'incident.contained',
    'incident.failed',
    'incident.halted',
  ];
  const removers = names.map((n) => {
    const h = forward(n);
    es.addEventListener(n, h as EventListener);
    return () => es.removeEventListener(n, h as EventListener);
  });
  es.onerror = () => {
    onError?.();
  };
  return () => {
    removers.forEach((r) => r());
    es.close();
  };
}
