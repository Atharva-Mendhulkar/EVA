import { NextResponse } from 'next/server';
import { sessionStore } from '@/lib/session/store';

// POST /api/v1/sessions — mint an ephemeral session. The secret is returned
// exactly once and never persisted server-side (only its SHA-256 hash).
export async function POST() {
  const { record, sessionSecret } = sessionStore.createSession();
  return NextResponse.json(
    { sessionId: record.sessionId, sessionSecret, expiresAt: record.expiresAt },
    { status: 201 }
  );
}
