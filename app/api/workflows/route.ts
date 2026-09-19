import { NextRequest, NextResponse } from 'next/server';
import { workflowStore } from '@/lib/engine/state-machine';

export async function GET() {
  return NextResponse.json(workflowStore.getActiveWorkflow());
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { intent, userId } = body;
    const workflow = workflowStore.createWorkflow(intent, undefined, userId);
    return NextResponse.json(workflow, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
