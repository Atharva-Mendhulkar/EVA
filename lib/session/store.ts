// EVA Ephemeral Session Service (PRD Section 9.1 & 12)
// Triple-primitive separation: public sessionId, bearer sessionSecret
// (server holds ONLY its SHA-256 hash), client-only Web Crypto aesKey.
// Storage is interface-driven: InMemorySessionStore now, DynamoDB
// single-table (PK SESSION#<id> / SK METADATA) later without changing callers.

import { randomBytes, timingSafeEqual } from 'crypto';
import { SessionRecord } from '../engine/types';
import { sha256Hex } from '../audit/chain';

const SESSION_TTL_SECONDS = Number(process.env.SESSION_TTL_SECONDS || 86400);

export interface SessionStore {
  createSession(): { record: SessionRecord; sessionSecret: string };
  validateSession(sessionId: string, sessionSecret: string): SessionRecord | null;
  revokeSession(sessionId: string): boolean;
}

export class InMemorySessionStore implements SessionStore {
  private sessions = new Map<string, SessionRecord>();

  public createSession(): { record: SessionRecord; sessionSecret: string } {
    const sessionId = randomBytes(32).toString('base64url');
    const sessionSecret = randomBytes(32).toString('base64url');
    const now = Date.now();
    const record: SessionRecord = {
      sessionId,
      secretHash: sha256Hex(sessionSecret),
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + SESSION_TTL_SECONDS * 1000).toISOString(),
      status: 'active'
    };
    this.sessions.set(sessionId, record);
    return { record, sessionSecret };
  }

  public validateSession(sessionId: string, sessionSecret: string): SessionRecord | null {
    const record = this.sessions.get(sessionId);
    if (!record || record.status !== 'active') return null;
    if (Date.now() > new Date(record.expiresAt).getTime()) {
      record.status = 'expired';
      return null;
    }
    const presented = Buffer.from(sha256Hex(sessionSecret), 'hex');
    const expected = Buffer.from(record.secretHash, 'hex');
    if (presented.length !== expected.length || !timingSafeEqual(presented, expected)) {
      return null;
    }
    return record;
  }

  public revokeSession(sessionId: string): boolean {
    const record = this.sessions.get(sessionId);
    if (!record) return false;
    record.status = 'revoked';
    return true;
  }
}

const globalForSession = globalThis as unknown as {
  evaSessionStore?: InMemorySessionStore;
};

export const sessionStore = globalForSession.evaSessionStore ?? new InMemorySessionStore();
globalForSession.evaSessionStore = sessionStore;


/** Extracts and validates session credentials from PRD Section 13 headers. */
export function requireSession(req: Request): SessionRecord | null {
  const sessionId = req.headers.get('X-EVA-Session-Id');
  const auth = req.headers.get('Authorization');
  const secret = auth && auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!sessionId || !secret) return null;
  return sessionStore.validateSession(sessionId, secret);
}
