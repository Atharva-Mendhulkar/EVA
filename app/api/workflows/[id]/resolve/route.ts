import { NextRequest, NextResponse } from 'next/server';
import { workflowStore } from '@/lib/engine/state-machine';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { conflictId, selectedEvidenceId, overrideValue } = body;

    if (!conflictId || (!selectedEvidenceId && !overrideValue)) {
      return NextResponse.json(
        { error: 'Missing conflictId or selectedEvidenceId/overrideValue' },
        { status: 400 }
      );
    }

    const updatedWorkflow = workflowStore.resolveConflict(
      id,
      conflictId,
      selectedEvidenceId,
      overrideValue
    );

    return NextResponse.json(updatedWorkflow);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
