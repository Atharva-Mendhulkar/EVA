import { NextRequest, NextResponse } from 'next/server';
import { workflowStore } from '@/lib/engine/state-machine';
import { requireSession } from '@/lib/session/store';
import { extractUrls, isGoogleFormUrl } from '@/lib/engine/form-parser';

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
    const { intent, template, userId, attachedDocumentIds, enableSearch, enableFormFill } = body;
    const resolvedTemplate =
      template ||
      (enableFormFill ? 'google_forms_fill' : (enableSearch ? 'web_search_research' : undefined));
    let workflow = workflowStore.createWorkflow(intent, resolvedTemplate, userId, undefined, 0, attachedDocumentIds);

    // If a Google Form URL is present, dynamically ingest live public schema
    const urls = extractUrls(intent || '');
    const gFormUrl = urls.find((u) => isGoogleFormUrl(u));
    if (gFormUrl) {
      try {
        workflow = await workflowStore.ingestGoogleForm(workflow.workflowRunId, gFormUrl);
      } catch (err) {
        console.warn('Google Form dynamic fetch note:', err);
      }
    }

    return NextResponse.json(workflow, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
