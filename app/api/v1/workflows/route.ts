import { NextRequest, NextResponse } from 'next/server';
import { workflowStore } from '@/lib/engine/state-machine';
import { requireSession } from '@/lib/session/store';
import { extractUrls, isGoogleFormUrl, isWebFormUrl } from '@/lib/engine/form-parser';

export async function GET(req: NextRequest) {
  const session = requireSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const active = workflowStore.getActiveWorkflow(session.sessionId);
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
  const session = requireSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await req.json().catch(() => ({}));
    const { intent, template, userId, attachedDocumentIds, enableSearch, enableFormFill } = body;
    const resolvedTemplate =
      template ||
      (enableFormFill ? 'google_forms_fill' : (enableSearch ? 'web_search_research' : undefined));
    let workflow = workflowStore.createWorkflow(intent, resolvedTemplate, userId, undefined, 0, attachedDocumentIds, session.sessionId);

    // If a Google Form or Web Form URL is present, dynamically ingest live schema
    const urls = extractUrls(intent || '');
    const formUrl = urls.find((u) => isWebFormUrl(u) || isGoogleFormUrl(u));
    if (formUrl) {
      try {
        workflow = await workflowStore.ingestGoogleForm(workflow.workflowRunId, formUrl);
      } catch (err) {
        console.warn('Web Form dynamic fetch note:', err);
      }
    }

    return NextResponse.json(workflow, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
