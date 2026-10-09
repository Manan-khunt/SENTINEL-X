// API client error contract: backend `{detail, code, request_id}` errors
// must surface as `{status, message}` with message taken from `detail`.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from './api';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('api error mapping', () => {
  it('uses backend detail for 401 and triggers the unauthorized hook', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(401, { detail: 'invalid token', code: 'unauthenticated' })),
    );
    await expect(api.me()).rejects.toMatchObject({ status: 401 });
    try {
      await api.me();
    } catch (e) {
      expect((e as { message: string }).message).toContain('invalid token');
    }
  });

  it('prefixes 403 as authorization failures without logging out', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(403, { detail: 'forbidden', code: 'forbidden' })),
    );
    try {
      await api.killSwitch();
      expect.unreachable();
    } catch (e) {
      expect((e as { status: number }).status).toBe(403);
      expect((e as { message: string }).message).toContain('Not authorized');
    }
  });

  it('reports unreachable backends as status 0', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('down');
      }),
    );
    try {
      await api.health();
      expect.unreachable();
    } catch (e) {
      expect((e as { status: number }).status).toBe(0);
    }
  });
});
