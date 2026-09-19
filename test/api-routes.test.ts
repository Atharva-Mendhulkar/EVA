import { describe, it, expect, beforeAll } from 'vitest';
import { NextRequest } from 'next/server';
import { sessionStore } from '../lib/session/store';
import { workflowStore } from '../lib/engine/state-machine';
import { POST as registerDocumentPost } from '../app/api/v1/workflows/[id]/documents/route';
import { GET as getEvidenceGet } from '../app/api/v1/workflows/[id]/evidence/route';
import { POST as resolvePost } from '../app/api/v1/workflows/[id]/resolve/route';
import { POST as conflictResolvePost } from '../app/api/v1/workflows/[id]/conflicts/[conflictId]/resolve/route';
import { POST as approvePost } from '../app/api/v1/workflows/[id]/approve/route';
import { GET as auditGet } from '../app/api/v1/workflows/[id]/audit/route';
import { POST as resetPost } from '../app/api/v1/workflows/[id]/reset/route';
import { POST as vaultUploadPost } from '../app/api/v1/vault/upload/route';
import { GET as vaultDocumentsGet } from '../app/api/v1/vault/documents/route';
import { POST as createSessionPost } from '../app/api/v1/sessions/route';
import { DELETE as revokeSessionDelete } from '../app/api/v1/sessions/[id]/route';

describe('PRD Section 13 API Endpoints & Handlers', () => {
  beforeAll(() => {
    workflowStore.seedInitialWorkflows();
  });

  const { record, sessionSecret } = sessionStore.createSession();
  const authHeaders = {
    'X-EVA-Session-Id': record.sessionId,
    'Authorization': `Bearer ${sessionSecret}`
  };

  it('mints ephemeral session via POST /api/v1/sessions', async () => {
    const res = await createSessionPost();
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.sessionId).toBeDefined();
    expect(body.sessionSecret).toBeDefined();
    expect(body.expiresAt).toBeDefined();
  });

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

  it('resolves conflict via parameterized POST /api/v1/workflows/:id/conflicts/:conflictId/resolve', async () => {
    const wf = workflowStore.createWorkflow("I'm starting an internship in Bangalore");
    const conflict = wf.conflicts[0];
    const targetEv = conflict.candidateEvidence[0];

    const req = new NextRequest(
      `http://localhost:3000/api/v1/workflows/${wf.workflowRunId}/conflicts/${conflict.conflictId}/resolve`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders
        },
        body: JSON.stringify({
          selectedEvidenceId: targetEv.evidenceId
        })
      }
    );

    const res = await conflictResolvePost(req, {
      params: Promise.resolve({ id: wf.workflowRunId, conflictId: conflict.conflictId })
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('AWAITING_HUMAN_APPROVAL');
  });

  it('submits human approval gate via POST /api/v1/workflows/:id/approve', async () => {
    const wf = workflowStore.createWorkflow("I'm starting an internship in Bangalore");
    const conflict = wf.conflicts[0];
    const resolved = workflowStore.resolveConflict(wf.workflowRunId, conflict.conflictId, conflict.candidateEvidence[0].evidenceId);

    const req = new NextRequest(`http://localhost:3000/api/v1/workflows/${wf.workflowRunId}/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders
      },
      body: JSON.stringify({
        decision: 'APPROVE',
        notes: 'API Handler test approved',
        nonce: resolved.approvalChallenge?.nonce
      })
    });

    const res = await approvePost(req, {
      params: Promise.resolve({ id: wf.workflowRunId })
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('COMPLETED');
  });

  it('retrieves tamper-evident audit trail via GET /api/v1/workflows/:id/audit', async () => {
    const wf = workflowStore.getActiveWorkflow()!;
    const req = new NextRequest(`http://localhost:3000/api/v1/workflows/${wf.workflowRunId}/audit`, {
      method: 'GET',
      headers: authHeaders
    });

    const res = await auditGet(req, {
      params: Promise.resolve({ id: wf.workflowRunId })
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.workflowRunId).toBe(wf.workflowRunId);
    expect(body.auditTrail.length).toBeGreaterThan(0);
  });

  it('resets workflow to initial demo state via POST /api/v1/workflows/:id/reset', async () => {
    const req = new NextRequest('http://localhost:3000/api/v1/workflows/run_demo_01/reset', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders
      },
      body: '{}'
    });

    const res = await resetPost(req, {
      params: Promise.resolve({ id: 'run_demo_01' })
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('AWAITING_USER_RESOLUTION');
    expect(body.conflicts.length).toBeGreaterThan(0);
  });

  it('handles vault document upload via POST /api/v1/vault/upload', async () => {
    // 1. Rejects without session auth
    const unauthReq = new NextRequest('http://localhost:3000/api/v1/vault/upload', {
      method: 'POST'
    });
    const unauthRes = await vaultUploadPost(unauthReq);
    expect(unauthRes.status).toBe(401);

    // 2. Ingests file with auth
    const fd = new FormData();
    fd.append('file', new Blob(['Full Legal Name: Atharva Mendhulkar\nWork Location: Bangalore\n'], { type: 'text/plain' }), 'test_offer.txt');

    const authReq = new NextRequest('http://localhost:3000/api/v1/vault/upload', {
      method: 'POST',
      headers: authHeaders,
      body: fd
    });
    const uploadRes = await vaultUploadPost(authReq);
    expect(uploadRes.status).toBe(200);
    const body = await uploadRes.json();
    expect(body.success).toBe(true);
    expect(body.document.sha256Fingerprint).toBeDefined();
    expect(body.document.name).toBe('test_offer.txt');
  });

  it('retrieves vault documents via GET /api/v1/vault/documents', async () => {
    const req = new NextRequest('http://localhost:3000/api/v1/vault/documents', {
      method: 'GET',
      headers: authHeaders
    });
    const res = await vaultDocumentsGet(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.documents.length).toBeGreaterThanOrEqual(1);
  });

  it('revokes session via DELETE /api/v1/sessions/:id', async () => {
    const { record: tempRecord, sessionSecret: tempSecret } = sessionStore.createSession();
    const req = new NextRequest(`http://localhost:3000/api/v1/sessions/${tempRecord.sessionId}`, {
      method: 'DELETE',
      headers: {
        'X-EVA-Session-Id': tempRecord.sessionId,
        'Authorization': `Bearer ${tempSecret}`
      }
    });

    const res = await revokeSessionDelete(req, {
      params: Promise.resolve({ id: tempRecord.sessionId })
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('revoked');
    expect(sessionStore.validateSession(tempRecord.sessionId, tempSecret)).toBeNull();
  });
});
