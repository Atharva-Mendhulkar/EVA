import { NextRequest, NextResponse } from 'next/server';
import { sessionStore, requireSession } from '@/lib/session/store';

// DELETE /api/v1/sessions/:id — revoke the session (self-only: the bearer
// secret for :id must validate).
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!requireSession(req) || req.headers.get('X-EVA-Session-Id') !== id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  sessionStore.revokeSession(id);
  return NextResponse.json({ sessionId: id, status: 'revoked' });
}
