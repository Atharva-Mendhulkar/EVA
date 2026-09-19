import { describe, it, expect } from 'vitest';
import { verifyAuditChain } from '@/lib/audit/chain';

const VERCEL_BASE = 'https://agenteva.vercel.app';
const AWS_BASE = 'https://k100udzhk6.execute-api.us-east-1.amazonaws.com';

describe('EVA Production Deployment Verification', () => {
  it('AWS API Gateway: responds healthy', async () => {
    const res = await fetch(`${AWS_BASE}/`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('healthy');
    expect(data.service).toBe('eva-core-backend');
  });

  it('Vercel Frontend: serves UI with 200 OK', async () => {
    const res = await fetch(VERCEL_BASE);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('EVA');
  });

  it('Vercel Full Lifecycle: session -> conflict -> cedar -> approval -> audit -> chain integrity', async () => {
    // 1. Create ephemeral session
    const sessRes = await fetch(`${VERCEL_BASE}/api/v1/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}'
    });
    expect(sessRes.status).toBe(201);
    const { sessionId, sessionSecret } = await sessRes.json();
    expect(sessionId).toBeDefined();
    expect(sessionSecret).toBeDefined();

    const authHeaders = {
      'Content-Type': 'application/json',
      'X-EVA-Session-Id': sessionId,
      'Authorization': `Bearer ${sessionSecret}`
    };

    // 2. Reset workflow to clean initial state
    const resetRes = await fetch(`${VERCEL_BASE}/api/v1/workflows/run_demo_01/reset`, {
      method: 'POST',
      headers: authHeaders,
      body: '{}'
    });
    expect(resetRes.status).toBe(200);
    const wf = await resetRes.json();
    expect(wf.status).toBe('AWAITING_USER_RESOLUTION');
    expect(wf.conflicts.length).toBeGreaterThan(0);
    const conflict = wf.conflicts[0];
    expect(conflict.field).toBe('work_location');

    // 3. Resolve conflict (select Bangalore offer letter)
    const resolveRes = await fetch(
      `${VERCEL_BASE}/api/v1/workflows/run_demo_01/conflicts/${conflict.conflictId}/resolve`,
      {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ selectedEvidenceId: 'ev_offer_location_run_demo_01' })
      }
    );
    expect(resolveRes.status).toBe(200);
    const resolvedWf = await resolveRes.json();
    expect(resolvedWf.status).toBe('AWAITING_HUMAN_APPROVAL');
    expect(resolvedWf.formFields.length).toBe(6);
    expect(resolvedWf.approvalChallenge?.nonce).toBeDefined();

    // 4. Submit human approval with cryptographic single-use nonce
    const approveRes = await fetch(`${VERCEL_BASE}/api/v1/workflows/run_demo_01/approve`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        decision: 'APPROVE',
        notes: 'Verified in production test suite',
        nonce: resolvedWf.approvalChallenge.nonce
      })
    });
    expect(approveRes.status).toBe(200);
    const approvedWf = await approveRes.json();
    expect(approvedWf.status).toBe('COMPLETED');
    expect(approvedWf.currentStep).toBe('Submission complete');
    expect(approvedWf.plan[7].status).toBe('COMPLETED');

    // 5. Audit trail & cryptographic hash chain verification
    const auditRes = await fetch(`${VERCEL_BASE}/api/v1/workflows/run_demo_01/audit`, {
      headers: authHeaders
    });
    expect(auditRes.status).toBe(200);
    const auditData = await auditRes.json();
    expect(auditData.auditTrail.length).toBeGreaterThanOrEqual(10);

    const verification = verifyAuditChain(auditData.auditTrail);
    expect(verification.valid).toBe(true);
    expect(verification.brokenAtIndex).toBeNull();
    expect(verification.checked).toBeGreaterThanOrEqual(6);
  });
});
