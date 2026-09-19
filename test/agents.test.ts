import { describe, it, expect } from 'vitest';
import {
  plannerAgent,
  searchAgent,
  evidenceAgent,
  formAgent,
  auditorAgent,
  orchestratorAgent,
  PlannerAgent,
  SearchResearchAgent,
  DocumentEvidenceAgent,
  FormExecutionAgent,
  ComplianceAuditorAgent,
  OrchestratorAgent
} from '../lib/agents';
import { workflowStore } from '../lib/engine/state-machine';

describe('EVA 6-Agent Multi-Agent Architecture', () => {
  // ─── 1. Planner Agent ───────────────────────────────────────────────────────
  describe('1. Planner Agent', () => {
    it('generates an ordered 8-step execution plan from intent', async () => {
      const plan = await plannerAgent.generate_plan('internship_onboarding', "I'm starting an internship in Bangalore");
      expect(plan).toHaveLength(8);
      expect(plan[0].name).toBe('Understand request');
      expect(plan[0].status).toBe('COMPLETED');
      expect(plan[1].name).toBe('Gather documents');
      expect(plan[7].name).toBe('Submit');
    });

    it('validates plan dependencies correctly', async () => {
      const plan = await plannerAgent.generate_plan('internship_onboarding', 'Test');
      const validation = await plannerAgent.validate_plan(plan);
      expect(validation.valid).toBe(true);
      expect(validation.blockedSteps).toHaveLength(0);
    });

    it('replans on failure by halting at the failed step and blocking descendants', async () => {
      const plan = await plannerAgent.generate_plan('internship_onboarding', 'Test');
      const replanned = await plannerAgent.replan_on_failure(plan, 4, 'Unresolvable conflict');
      const step4 = replanned.find((s) => s.stepId === 4);
      const step5 = replanned.find((s) => s.stepId === 5);
      expect(step4?.status).toBe('FAILED');
      expect(step4?.detail).toContain('Unresolvable conflict');
      expect(step5?.status).toBe('PENDING');
      expect(step5?.detail).toContain('Blocked by prerequisite');
    });

    it('exposes a valid Strands .asTool() interface', async () => {
      const tool = plannerAgent.asTool();
      expect(tool.name).toBe('planner');
      expect(tool.delegate).toBe(false);
      const res = await tool.invoke({ template: 'internship_onboarding', intent: 'Sample' });
      expect(res).toHaveLength(8);
    });
  });

  // ─── 2. Search / Research Agent ─────────────────────────────────────────────
  describe('2. Search / Research Agent', () => {
    it('searches Personal Vault and ranks target documents higher', async () => {
      const results = await searchAgent.search_vault('usr_test', [], 'internship_onboarding');
      expect(results.length).toBeGreaterThanOrEqual(3);
      expect(results[0].relevanceScore).toBeGreaterThan(results[results.length - 1].relevanceScore);
      expect(results[0].s3Key).toContain('usr_test');
    });

    it('wraps external web search in <untrusted_web_data> guardrails', async () => {
      const webResults = await searchAgent.search_web('Acme Corp Bangalore', 2);
      expect(webResults).toHaveLength(1);
      expect(webResults[0].isUntrusted).toBe(true);
      expect(webResults[0].snippet).toContain('<untrusted_web_data');
    });

    it('checks document freshness against 90-day threshold', async () => {
      const freshness = await searchAgent.check_document_freshness('doc_profile_01');
      expect(freshness).toHaveProperty('isFresh');
      expect(freshness).toHaveProperty('ageInDays');
    });

    it('ranks documents by freshness and PDF verification', async () => {
      const ranked = await searchAgent.rank_documents([
        {
          documentId: 'd1',
          name: 'Recent.pdf',
          sizeBytes: 1000,
          updatedAt: new Date().toISOString(),
          type: 'application/pdf',
          sensitivity: 'standard',
          description: 'Recent'
        }
      ]);
      expect(ranked[0].score).toBeGreaterThanOrEqual(0.8);
      expect(ranked[0].reasons).toContain('Official PDF format verified');
    });
  });

  // ─── 3. Document Evidence Agent ─────────────────────────────────────────────
  describe('3. Document Evidence Agent', () => {
    it('extracts structured fields with confidence scores', async () => {
      const evidence = await evidenceAgent.extract_fields('Personal_Profile.pdf', 's3://vault/profile.pdf', ['full_name', 'work_location']);
      expect(evidence.length).toBeGreaterThanOrEqual(2);
      const nameEv = evidence.find((e) => e.field === 'full_name');
      expect(nameEv?.value).toBe('Atharva Mendhulkar');
      expect(nameEv?.confidence).toBeGreaterThanOrEqual(0.9);
    });

    it('detects deterministic contradictions without an LLM', async () => {
      const evidence = [
        {
          evidenceId: 'ev_1',
          workflowRunId: 'r1',
          field: 'work_location' as const,
          value: 'Mumbai',
          sourceDocumentId: 'd1',
          sourceDocumentName: 'Profile.pdf',
          sourceLocation: 'p1',
          sourceExcerpt: 'Mumbai',
          extractedAt: new Date().toISOString(),
          documentUpdatedAt: new Date().toISOString(),
          confidence: 0.96
        },
        {
          evidenceId: 'ev_2',
          workflowRunId: 'r1',
          field: 'work_location' as const,
          value: 'Bangalore',
          sourceDocumentId: 'd2',
          sourceDocumentName: 'Offer.pdf',
          sourceLocation: 'p1',
          sourceExcerpt: 'Bangalore',
          extractedAt: new Date().toISOString(),
          documentUpdatedAt: new Date().toISOString(),
          confidence: 0.98
        }
      ];
      const conflictResult = await evidenceAgent.detect_conflicts('r1', evidence);
      expect(conflictResult.hasCriticalConflict).toBe(true);
      expect(conflictResult.conflicts[0].field).toBe('work_location');
    });

    it('enforces strict zero-hallucination refusal for missing fields', () => {
      const refusal = evidenceAgent.refuse_missing_field('bank_account_number', 'Not in documents');
      expect(refusal.confidence).toBe(0.0);
      expect(refusal.sourceExcerpt).toContain('Zero-hallucination refusal enforced');
    });
  });

  // ─── 4. Form Execution Agent (Bureaucrat) ───────────────────────────────────
  describe('4. Form Execution Agent (Bureaucrat)', () => {
    it('strictly denies submit_form without human approval', async () => {
      const decision = await formAgent.evaluate_authorization('Action::"submit_form"', {
        conflict_resolved: true,
        evidence_confidence: 0.98,
        human_approved: false, // NOT approved
        workflow_scope: 'internship_onboarding'
      });
      expect(decision.decision).toBe('DENY');
      expect(decision.reason).toContain('human approval');
    });

    it('authorizes submit_form once human consent is granted', async () => {
      const decision = await formAgent.evaluate_authorization('Action::"submit_form"', {
        conflict_resolved: true,
        evidence_confidence: 0.98,
        human_approved: true, // APPROVED
        workflow_scope: 'internship_onboarding'
      });
      expect(decision.decision).toBe('ALLOW');
    });

    it('populates form field with provenance tag and returns verified field', async () => {
      const field = await formAgent.populate_field('fld_work_location', 'Bangalore', 'ev_offer_loc', {
        evidenceId: 'ev_offer_loc',
        sourceDocumentName: 'Offer_Letter.pdf',
        sourceLocation: 'Page 1, Paragraph 2',
        confidence: 0.98,
        userConfirmed: true
      });
      expect(field.value).toBe('Bangalore');
      expect(field.userConfirmed).toBe(true);
      expect(field.sourceDocument).toBe('Offer_Letter.pdf');
    });

    it('issues sandbox submission receipt on external action', async () => {
      const receipt = await formAgent.submit_form('form_onboarding_01', 'Acme HR Endpoint');
      expect(receipt.statusCode).toBe(200);
      expect(receipt.receiptId).toContain('rcpt_');
      expect(receipt.fieldsSubmitted).toBe(6);
    });
  });

  // ─── 5. Compliance Auditor Agent ───────────────────────────────────────────
  describe('5. Compliance Auditor Agent', () => {
    it('audits completed workflow and yields PASS with high compliance score', async () => {
      // Create and advance a real run in store
      const run = workflowStore.createWorkflow("I'm starting an internship in Bangalore", 'internship_onboarding');
      // Resolve conflict
      workflowStore.resolveConflict(run.workflowRunId, run.conflicts[0].conflictId, run.conflicts[0].candidateEvidence[1].evidenceId);
      // Approve submission
      workflowStore.approveSubmission(run.workflowRunId, 'APPROVE', 'Verified');

      const audit = await auditorAgent.audit_workflow(run.workflowRunId);
      expect(audit.result).toBe('PASS');
      expect(audit.complianceScore).toBeGreaterThanOrEqual(0.8);
      expect(audit.totalCedarDecisions).toBeGreaterThanOrEqual(2);
    });

    it('flags chronological timestamp errors', async () => {
      const outOfOrderEvents = [
        {
          eventId: 'e1',
          workflowRunId: 'r1',
          timestamp: '2026-09-18T10:05:00Z',
          actor: 'orchestrator',
          action: 'step1',
          decision: 'INFO' as const,
          reason: 'first'
        },
        {
          eventId: 'e2',
          workflowRunId: 'r1',
          timestamp: '2026-09-18T10:00:00Z', // BEFORE e1!
          actor: 'orchestrator',
          action: 'step2',
          decision: 'INFO' as const,
          reason: 'second'
        }
      ];
      const check = await auditorAgent.verify_chronological_order(outOfOrderEvents);
      expect(check.valid).toBe(false);
      expect(check.violations.length).toBeGreaterThan(0);
    });

    it('generates a full compliance report', async () => {
      const run = workflowStore.getActiveWorkflow();
      const report = await auditorAgent.generate_compliance_report(run.workflowRunId);
      expect(report).toHaveProperty('status');
      expect(report).toHaveProperty('auditResult');
      expect(report.recommendations.length).toBeGreaterThan(0);
    });
  });

  // ─── 6. Orchestrator Agent ─────────────────────────────────────────────────
  describe('6. Orchestrator Agent (Master)', () => {
    it('classifies intents across multiple enterprise domains', async () => {
      expect((await orchestratorAgent.classify_intent('Need a new MacBook workstation')).template).toBe('hardware_procurement');
      expect((await orchestratorAgent.classify_intent('Reimburse my hospital bill')).template).toBe('medical_reimbursement');
      expect((await orchestratorAgent.classify_intent('Update vendor payout IFSC')).template).toBe('vendor_payout_update');
      expect((await orchestratorAgent.classify_intent('Starting my internship')).template).toBe('internship_onboarding');
    });

    it('orchestrates end-to-end execution through specialist agents', async () => {
      const run = await orchestratorAgent.execute_workflow("I'm starting an internship in Bangalore");
      expect(run.workflowRunId).toBeDefined();
      expect(run.plan).toHaveLength(8);
      expect(run.status).toBe('AWAITING_USER_RESOLUTION');

      // Human resolves conflict through orchestrator
      const resolvedRun = await orchestratorAgent.resolve_and_populate(
        run.workflowRunId,
        run.conflicts[0].conflictId,
        run.conflicts[0].candidateEvidence[1].evidenceId
      );
      expect(resolvedRun.status).toBe('AWAITING_HUMAN_APPROVAL');
      expect(resolvedRun.formFields.length).toBeGreaterThan(0);

      // Human approves submission through orchestrator
      const completedRun = await orchestratorAgent.approve_and_submit(run.workflowRunId, 'APPROVE', 'All set');
      expect(completedRun.status).toBe('COMPLETED');

      // Auditor verifies final compliance
      const auditResult = await orchestratorAgent.audit_and_verify(run.workflowRunId);
      expect(auditResult.result).toBe('PASS');
    });

    it('exposes all 5 specialist agents as callable tools via .asTool()', () => {
      expect(orchestratorAgent.planner.asTool().name).toBe('planner');
      expect(orchestratorAgent.search.asTool().name).toBe('search');
      expect(orchestratorAgent.evidence.asTool().name).toBe('evidence_extractor');
      expect(orchestratorAgent.formExecutor.asTool().name).toBe('form_executor');
      expect(orchestratorAgent.auditor.asTool().name).toBe('compliance_auditor');
    });
  });
});
