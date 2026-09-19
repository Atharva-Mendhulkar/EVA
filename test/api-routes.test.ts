import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { sessionStore } from '../lib/session/store';
import { workflowStore } from '../lib/engine/state-machine';
import { POST as registerDocumentPost } from '../app/api/v1/workflows/[id]/documents/route';
import { GET as getEvidenceGet } from '../app/api/v1/workflows/[id]/evidence/route';
import { POST as resolvePost } from '../app/api/v1/workflows/[id]/resolve/route';

describe('PRD Section 13 API Endpoints & Handlers', () => {
  const { record, sessionSecret } = sessionStore.createSession();
  const authHeaders = {
    'X-EVA-Session-Id': record.sessionId,
    'Authorization': `Bearer ${sessionSecret}`
  };

  it('registers document metadata via POST /api/v1/workflows/:id/documents', async () => {
    const wf = workflowStore.getActiveWorkflow()!;
    const req = new NextRequest(`http://localhost:3000/api/v1/workflows/${wf.workflowRunId}/documents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders
      },
      body: JSON.stringify({
        name: 'Encrypted_Tax_Record.pdf',
        sizeBytes: 10240,
        type: 'application/pdf',
        sensitivity: 'financial',
        checksum: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
      })
    });

    const res = await registerDocumentPost(req, {
      params: Promise.resolve({ id: wf.workflowRunId })
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.document.name).toBe('Encrypted_Tax_Record.pdf');
    expect(body.document.sensitivity).toBe('financial');
  });

  it('retrieves evidence list via GET /api/v1/workflows/:id/evidence', async () => {
    const wf = workflowStore.getActiveWorkflow()!;
    const req = new NextRequest(`http://localhost:3000/api/v1/workflows/${wf.workflowRunId}/evidence`, {
      method: 'GET',
      headers: authHeaders
    });

    const res = await getEvidenceGet(req, {
      params: Promise.resolve({ id: wf.workflowRunId })
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.workflowRunId).toBe(wf.workflowRunId);
    expect(body.evidence.length).toBeGreaterThanOrEqual(1);
    expect(body.evidenceCount).toBe(body.evidence.length);
  });

  it('resolves conflict via POST /api/v1/workflows/:id/resolve', async () => {
    const wf = workflowStore.createWorkflow("I'm starting an internship in Bangalore");
    const conflict = wf.conflicts[0];
    const targetEv = conflict.candidateEvidence[1];

    const req = new NextRequest(`http://localhost:3000/api/v1/workflows/${wf.workflowRunId}/resolve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders
      },
      body: JSON.stringify({
        conflictId: conflict.conflictId,
        selectedEvidenceId: targetEv.evidenceId
      })
    });

    const res = await resolvePost(req, {
      params: Promise.resolve({ id: wf.workflowRunId })
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('AWAITING_HUMAN_APPROVAL');
    expect(body.formPopulationPlan).toBeDefined();
  });
});
