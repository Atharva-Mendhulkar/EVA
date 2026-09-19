import { NextRequest, NextResponse } from 'next/server';
import { workflowStore } from '@/lib/engine/state-machine';
import { requireSession } from '@/lib/session/store';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!requireSession(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { id } = await params;
    return NextResponse.json(workflowStore.resetWorkflow(id));
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 404 });
  }
}
