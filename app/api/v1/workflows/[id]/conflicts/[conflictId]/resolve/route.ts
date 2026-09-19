import { NextRequest, NextResponse } from 'next/server';
import { workflowStore } from '@/lib/engine/state-machine';
import { requireSession } from '@/lib/session/store';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; conflictId: string }> }
) {
  if (!requireSession(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { id, conflictId: paramConflictId } = await params;
    const body = await req.json().catch(() => ({}));
    const conflictId = body.conflictId || paramConflictId;
    const { selectedEvidenceId, overrideValue } = body;

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
