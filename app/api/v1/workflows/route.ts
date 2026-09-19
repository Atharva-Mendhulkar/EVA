import { NextRequest, NextResponse } from 'next/server';
import { workflowStore } from '@/lib/engine/state-machine';
import { requireSession } from '@/lib/session/store';

export async function GET(req: NextRequest) {
  if (!requireSession(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const active = workflowStore.getActiveWorkflow();
  const { searchParams } = new URL(req.url);
  if (searchParams.get('all') === 'true') {
    return NextResponse.json({
      workflows: workflowStore.listWorkflows(),
      activeWorkflowId: active?.workflowRunId ?? null
    });
  }
  return NextResponse.json(active);
}

export async function POST(req: NextRequest) {
  if (!requireSession(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await req.json().catch(() => ({}));
    const { intent, template, userId, attachedDocumentIds } = body;
    const workflow = workflowStore.createWorkflow(intent, template, userId, undefined, 0, attachedDocumentIds);
    return NextResponse.json(workflow, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
