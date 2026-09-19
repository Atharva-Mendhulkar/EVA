// Tamper-evident audit hash chain (PRD Section 11 & ADR-011).
// eventHash = SHA-256(canonicalJson(event without eventHash) || previousEventHash),
// genesis previousEventHash = "GENESIS". Any modification or omission breaks
// continuity, which verifyAuditChain detects.

import { createHash } from 'crypto';
import { AuditEvent } from '../engine/types';

export const GENESIS_HASH = 'GENESIS';

export function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

/** Deterministic JSON serialization: object keys sorted recursively. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`;
}

/** Chains and appends an event to a trail in place. */
export function appendAuditEvent(trail: AuditEvent[], event: AuditEvent): AuditEvent {
  const previousEventHash = trail.length > 0
    ? trail[trail.length - 1].eventHash || GENESIS_HASH
    : GENESIS_HASH;
  event.previousEventHash = previousEventHash;
  const { eventHash: _ignored, ...rest } = event;
  event.eventHash = sha256Hex(canonicalJson(rest) + previousEventHash);
  trail.push(event);
  return event;
}

export interface ChainVerification {
  valid: boolean;
  checked: number;
  brokenAtIndex: number | null;
}

/** Recomputes every link. Events predating hash-chaining (no eventHash) are skipped. */
export function verifyAuditChain(trail: AuditEvent[]): ChainVerification {
  let checked = 0;
  for (let i = 0; i < trail.length; i++) {
    const event = trail[i];
    if (!event.eventHash) continue;
    const expectedPrev = i === 0
      ? GENESIS_HASH
      : trail[i - 1].eventHash || GENESIS_HASH;
    if (event.previousEventHash !== expectedPrev) {
      return { valid: false, checked, brokenAtIndex: i };
    }
    const { eventHash: _ignored, ...rest } = event;
    if (sha256Hex(canonicalJson(rest) + event.previousEventHash) !== event.eventHash) {
      return { valid: false, checked, brokenAtIndex: i };
    }
    checked++;
  }
  return { valid: true, checked, brokenAtIndex: null };
}
