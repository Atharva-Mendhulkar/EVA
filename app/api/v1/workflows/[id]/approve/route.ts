import { NextRequest, NextResponse } from 'next/server';
import { workflowStore } from '@/lib/engine/state-machine';
import { requireSession } from '@/lib/session/store';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!requireSession(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const { decision = 'APPROVE', notes, nonce } = body;

    const updatedWorkflow = workflowStore.approveSubmission(id, decision, notes, nonce);
    return NextResponse.json(updatedWorkflow);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
