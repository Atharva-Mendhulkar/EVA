import { NextRequest, NextResponse } from 'next/server';
import { workflowStore } from '@/lib/engine/state-machine';
import { requireSession } from '@/lib/session/store';

// GET /api/v1/workflows/:id/evidence — Returns structured evidence list with provenance (PRD Section 13)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!requireSession(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const workflow = workflowStore.getWorkflow(id);
  if (!workflow) {
    return NextResponse.json({ error: `Workflow ${id} not found` }, { status: 404 });
  }

  return NextResponse.json({
    workflowRunId: workflow.workflowRunId,
    template: workflow.template,
    evidenceCount: workflow.evidence.length,
    evidence: workflow.evidence
  });
}
