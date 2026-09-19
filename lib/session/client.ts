// Browser session bootstrap + authenticated fetch (PRD Section 9.1 & 13).
// The sessionSecret lives in sessionStorage only; closing the tab destroys it
// and the server copy (hash) becomes permanently unusable — zero-login
// ephemerality by construction.

import { apiUrl } from '@/lib/config';

interface SessionPair {
  sessionId: string;
  sessionSecret: string;
}

let cached: SessionPair | null = null;

export async function getSession(): Promise<SessionPair> {
  if (cached) return cached;
  if (typeof window !== 'undefined') {
    const stored = sessionStorage.getItem('eva_session');
    if (stored) {
      try {
        cached = JSON.parse(stored) as SessionPair;
        if (cached.sessionId && cached.sessionSecret) return cached;
      } catch {
        sessionStorage.removeItem('eva_session');
      }
    }
  }
  const res = await fetch('/api/v1/sessions', { method: 'POST' });
  if (!res.ok) throw new Error('Failed to create EVA session');
  cached = (await res.json()) as SessionPair;
  sessionStorage.setItem('eva_session', JSON.stringify(cached));
  return cached;
}

/** fetch() with X-EVA-Session-Id + Bearer sessionSecret attached. */
export async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const { sessionId, sessionSecret } = await getSession();
  const headers = new Headers(init.headers);
  headers.set('X-EVA-Session-Id', sessionId);
  headers.set('Authorization', `Bearer ${sessionSecret}`);
  return fetch(apiUrl(input), { ...init, headers });
}
