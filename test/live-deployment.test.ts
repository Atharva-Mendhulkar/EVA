import { describe, it, expect } from 'vitest';
import { verifyAuditChain } from '@/lib/audit/chain';

const VERCEL_BASE = 'https://agenteva.vercel.app';
const AWS_BASE = 'https://k100udzhk6.execute-api.us-east-1.amazonaws.com';

describe('EVA Production Deployment Verification', () => {
  describe('AWS Production Deployment', () => {
    it('AWS API Gateway root responds healthy', async () => {
      const res = await fetch(`${AWS_BASE}/`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe('healthy');
      expect(data.service).toBe('eva-core-backend');
      expect(data.path).toBe('/');
    });

    it('AWS API Gateway /health subroute responds healthy', async () => {
      const res = await fetch(`${AWS_BASE}/health`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe('healthy');
      expect(data.service).toBe('eva-core-backend');
      expect(data.path).toBe('/health');
    });
  });

  describe('Vercel Production Deployment', () => {
    it('Vercel Frontend serves UI with 200 OK', async () => {
      const res = await fetch(VERCEL_BASE);
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain('EVA');
    });

    it('Vercel Document Vault: upload document -> verify zero PII sha256 fingerprint -> inspect vault list', async () => {
      // 1. Ephemeral session
      const sessRes = await fetch(`${VERCEL_BASE}/api/v1/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}'
      });
      expect(sessRes.status).toBe(201);
      const { sessionId, sessionSecret } = await sessRes.json();

      const authHeaders = {
        'X-EVA-Session-Id': sessionId,
        'Authorization': `Bearer ${sessionSecret}`
      };

      // 2. Upload document via FormData
      const formData = new FormData();
      const fileBlob = new Blob(
        ['Internship Offer Letter\nCandidate Name: Atharva Mendhulkar\nOffice Location: Bangalore\n'],
        { type: 'text/plain' }
      );
      formData.append('file', fileBlob, 'live_offer_letter.txt');

      const uploadRes = await fetch(`${VERCEL_BASE}/api/v1/vault/upload`, {
        method: 'POST',
        headers: authHeaders,
        body: formData
      });
      expect(uploadRes.status).toBe(200);
      const uploadData = await uploadRes.json();
      expect(uploadData.success).toBe(true);
      expect(uploadData.document.sha256Fingerprint).toHaveLength(64);
      expect(uploadData.document.name).toBe('live_offer_letter.txt');

      // 3. Inspect vault documents list
      const docsRes = await fetch(`${VERCEL_BASE}/api/v1/vault/documents`, {
        headers: authHeaders
      });
      expect(docsRes.status).toBe(200);
      const docsData = await docsRes.json();
      expect(docsData.documents.length).toBeGreaterThanOrEqual(1);
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

      // 2. Initialize or reset workflow to clean initial state
      let wf: any;
      const resetRes = await fetch(`${VERCEL_BASE}/api/v1/workflows/run_demo_01/reset`, {
        method: 'POST',
        headers: authHeaders,
        body: '{}'
      });
      if (resetRes.status === 200) {
        wf = await resetRes.json();
      } else {
        const createRes = await fetch(`${VERCEL_BASE}/api/v1/workflows`, {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({
            intent: "I'm starting an internship in Bangalore",
            template: 'internship_onboarding'
          })
        });
        expect(createRes.status).toBe(201);
        wf = await createRes.json();
      }
      expect(wf.status).toBe('AWAITING_USER_RESOLUTION');
      expect(wf.conflicts.length).toBeGreaterThan(0);
      const conflict = wf.conflicts[0];
      const targetRunId = wf.workflowRunId;
      expect(conflict.field).toBe('work_location');

      // 3. Resolve conflict (select Bangalore offer letter)
      const selectedEvId = conflict.candidateEvidence.find((e: any) => e.value === 'Bangalore')?.evidenceId || conflict.candidateEvidence[1].evidenceId;
      const resolveRes = await fetch(
        `${VERCEL_BASE}/api/v1/workflows/${targetRunId}/conflicts/${conflict.conflictId}/resolve`,
        {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({ selectedEvidenceId: selectedEvId })
        }
      );
      expect(resolveRes.status).toBe(200);
      const resolvedWf = await resolveRes.json();
      expect(resolvedWf.status).toBe('AWAITING_HUMAN_APPROVAL');
      expect(resolvedWf.formFields.length).toBe(6);
      expect(resolvedWf.approvalChallenge?.nonce).toBeDefined();

      // 4. Submit human approval with cryptographic single-use nonce
      const approveRes = await fetch(`${VERCEL_BASE}/api/v1/workflows/${targetRunId}/approve`, {
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
      const auditRes = await fetch(`${VERCEL_BASE}/api/v1/workflows/${targetRunId}/audit`, {
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
});
