import { NextRequest, NextResponse } from 'next/server';
import { workflowStore } from '@/lib/engine/state-machine';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { decision = 'APPROVE', notes, nonce } = body;

    const updatedWorkflow = workflowStore.approveSubmission(id, decision, notes, nonce);
    return NextResponse.json(updatedWorkflow);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
