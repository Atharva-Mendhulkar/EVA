import { NextRequest, NextResponse } from 'next/server';
import { workflowStore } from '@/lib/engine/state-machine';
import { requireSession } from '@/lib/session/store';

export async function POST(req: NextRequest) {
  if (!requireSession(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await req.json().catch(() => ({}));
    const { runId } = body;
    if (!runId) {
      return NextResponse.json({ error: 'runId is required' }, { status: 400 });
    }
    const workflow = workflowStore.setActiveWorkflow(runId);
    return NextResponse.json(workflow);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
