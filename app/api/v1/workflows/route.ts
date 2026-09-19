import { NextRequest, NextResponse } from 'next/server';
import { workflowStore } from '@/lib/engine/state-machine';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  if (searchParams.get('all') === 'true') {
    return NextResponse.json({
      workflows: workflowStore.listWorkflows(),
      activeWorkflowId: workflowStore.getActiveWorkflow().workflowRunId
    });
  }
  const workflow = workflowStore.getActiveWorkflow();
  return NextResponse.json(workflow);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { intent, template, userId } = body;
    const workflow = workflowStore.createWorkflow(intent, template, userId);
    return NextResponse.json(workflow, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
