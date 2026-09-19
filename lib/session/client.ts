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
    try {
      const stored = sessionStorage.getItem('eva_session');
      if (stored) {
        cached = JSON.parse(stored) as SessionPair;
        if (cached && cached.sessionId && cached.sessionSecret) return cached;
      }
    } catch {
      // Ignore storage access errors
    }
  }
  try {
    const res = await fetch(apiUrl('/api/v1/sessions'), { method: 'POST' });
    if (res.ok) {
      cached = (await res.json()) as SessionPair;
      if (typeof window !== 'undefined' && cached) {
        try {
          sessionStorage.setItem('eva_session', JSON.stringify(cached));
        } catch {}
      }
      return cached;
    }
  } catch (err) {
    console.warn('EVA session generation fallback:', err);
  }

  // Graceful fallback to client-generated ephemeral session
  cached = {
    sessionId: `ses_client_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    sessionSecret: `sec_client_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  };
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
