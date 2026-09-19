import { describe, it, expect } from 'vitest';
import { sessionStore } from '../lib/session/store';
import { appendAuditEvent, verifyAuditChain } from '../lib/audit/chain';
import { AuditEvent } from '../lib/engine/types';

function baseEvent(action: string): AuditEvent {
  return {
    eventId: `aud_${action}`,
    workflowRunId: 'r1',
    timestamp: new Date().toISOString(),
    actor: 'test',
    action,
    decision: 'INFO',
    reason: action
  };
}

describe('EVA sessions & tamper-evident audit (PRD Sections 9 & 11)', () => {
  it('mints a secret returned once, validates via hash, rejects wrong secret', () => {
    const { record, sessionSecret } = sessionStore.createSession();
    expect(sessionSecret.length).toBeGreaterThan(30);
    expect(record.secretHash).not.toContain(sessionSecret);
    expect(sessionStore.validateSession(record.sessionId, sessionSecret)?.sessionId).toBe(record.sessionId);
    expect(sessionStore.validateSession(record.sessionId, 'wrong')).toBeNull();
  });

  it('revocation kills the session', () => {
    const { record, sessionSecret } = sessionStore.createSession();
    expect(sessionStore.revokeSession(record.sessionId)).toBe(true);
    expect(sessionStore.validateSession(record.sessionId, sessionSecret)).toBeNull();
  });

  it('hash-chained trail verifies, tampering breaks continuity', () => {
    const trail: AuditEvent[] = [];
    appendAuditEvent(trail, baseEvent('a'));
    appendAuditEvent(trail, baseEvent('b'));
    expect(verifyAuditChain(trail)).toEqual({ valid: true, checked: 2, brokenAtIndex: null });
    trail[1] = { ...trail[1], reason: 'forged' };
    const result = verifyAuditChain(trail);
    expect(result.valid).toBe(false);
    expect(result.brokenAtIndex).toBe(1);
  });
});
