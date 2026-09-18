import { NextRequest, NextResponse } from 'next/server';
import { workflowStore } from '@/lib/engine/state-machine';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const workflow = workflowStore.getWorkflow(id);
  if (!workflow) {
    return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
  }

  // NOTE: Server task token is NEVER exposed to the frontend!
  return NextResponse.json(workflow);
}
