import { NextRequest, NextResponse } from 'next/server';
import { workflowStore } from '@/lib/engine/state-machine';

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    return NextResponse.json(workflowStore.resetWorkflow(id));
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 404 });
  }
}
