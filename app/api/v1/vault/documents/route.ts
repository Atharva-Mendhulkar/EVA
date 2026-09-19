import { NextRequest, NextResponse } from 'next/server';
import { DEMO_VAULT_DOCUMENTS } from '@/lib/engine/fixtures';
import { requireSession } from '@/lib/session/store';

export async function GET(req: NextRequest) {
  if (!requireSession(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.json({
    documents: DEMO_VAULT_DOCUMENTS
  });
}
