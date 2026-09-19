import { describe, it, expect } from 'vitest';
import {
  orchestratorAgent,
  employmentAgent,
  evidenceAgent,
  formFillingAgent
} from '../lib/agents';
import { getSeedEvidence } from '../lib/engine/fixtures';

describe('EVA 4-Agent Architecture (PRD Section 5)', () => {
  describe('1. EVA Orchestrator', () => {
    it('classifies intents across enterprise domains', async () => {
      expect((await orchestratorAgent.classify_intent('Need a new MacBook workstation')).template).toBe('hardware_procurement');
      expect((await orchestratorAgent.classify_intent('Reimburse my hospital bill')).template).toBe('medical_reimbursement');
      expect((await orchestratorAgent.classify_intent('Update vendor payout IFSC')).template).toBe('vendor_payout_update');
      expect((await orchestratorAgent.classify_intent('Starting my internship')).template).toBe('internship_onboarding');
    });

    it('refuses to plan when intent confidence is below the 0.70 floor', async () => {
      const { confidence } = await orchestratorAgent.classify_intent('asdf qwer zxcv');
      expect(confidence).toBeLessThan(0.7);
      await expect(orchestratorAgent.initiate_workflow_plan('asdf qwer zxcv')).rejects.toThrow('0.70');
    });

    it('rejects unknown templates in domain selection', async () => {
      await expect(orchestratorAgent.select_domain_agent('nope')).rejects.toThrow('No domain agent');
    });

    it('orchestrates end-to-end: plan -> resolve -> approve(nonce) -> verified audit', async () => {
      const run = await orchestratorAgent.initiate_workflow_plan("I'm starting an internship in Bangalore");
      expect(run.status).toBe('AWAITING_USER_RESOLUTION');

      const progress = await orchestratorAgent.report_progress(run.workflowRunId);
      expect(progress.awaitingAction).toBe('CONFLICT_RESOLUTION');

      const resolved = await orchestratorAgent.resolve_and_populate(
        run.workflowRunId,
        run.conflicts[0].conflictId,
        run.conflicts[0].candidateEvidence[1].evidenceId
      );
      expect(resolved.status).toBe('AWAITING_HUMAN_APPROVAL');
      expect(resolved.formPopulationPlan?.mappings.length).toBeGreaterThan(0);
      expect(resolved.approvalChallenge?.status).toBe('pending');

      const completed = await orchestratorAgent.approve_and_submit(
        run.workflowRunId,
        'APPROVE',
        'All set',
        resolved.approvalChallenge?.nonce
      );
      expect(completed.status).toBe('COMPLETED');

      const audit = await orchestratorAgent.audit_and_verify(run.workflowRunId);
      expect(audit.valid).toBe(true);
      expect(audit.checked).toBeGreaterThan(0);
    });
  });

  describe('2. Employment Domain Agent', () => {
    it('emits canonical requirements plus the bank_account_number refusal canary', async () => {
      const fields = await employmentAgent.get_required_fields('internship_onboarding');
      expect(fields).toContain('work_location');
      expect(fields).toContain('bank_account_number');
    });

    it('validates the document checklist against available vault documents', async () => {
      const check = await employmentAgent.validate_document_checklist('internship_onboarding', ['doc_profile_01']);
      expect(check.met).toContain('doc_profile_01');
      expect(check.missing).toContain('doc_offer_03');
    });

    it('compiles an 8-step domain plan', async () => {
      const plan = await employmentAgent.compile_domain_plan('internship_onboarding', 'Test');
      expect(plan).toHaveLength(8);
      expect(plan[0].name).toBe('Understand request');
    });
  });

  describe('3. Evidence Agent', () => {
    it('extracts structured fields with confidence scores', async () => {
      const evidence = await evidenceAgent.extract_canonical_fields(
        'Personal_Profile.pdf',
        '',
        ['full_name', 'work_location']
      );
      const nameEv = evidence.find((e) => e.field === 'full_name');
      expect(nameEv?.value).toBe('Atharva Mendhulkar');
      expect(nameEv?.confidence).toBeGreaterThanOrEqual(0.9);
    });

    it('detects deterministic contradictions without an LLM', async () => {
      const evidence = getSeedEvidence('r1').filter((e) => e.field === 'work_location');
      const result = await evidenceAgent.detect_same_source_contradictions('r1', evidence);
      expect(result.hasCriticalConflict).toBe(true);
      expect(result.conflicts[0].field).toBe('work_location');
    });

    it('enforces zero-hallucination refusal for missing fields', async () => {
      const refusal = await evidenceAgent.refuse_missing_field('bank_account_number', 'Not in documents');
      expect(refusal.confidence).toBe(0.0);
      expect(refusal.sourceExcerpt).toContain('Zero-hallucination refusal enforced');
    });
  });

  describe('4. Form Filling Agent', () => {
    it('inspects the target form schema', async () => {
      const schema = await formFillingAgent.inspect_form_schema('internship_onboarding');
      expect(schema).toHaveLength(6);
      expect(schema.map((s) => s.field)).toContain('work_location');
    });

    it('generates a grounded FormPopulationPlan', async () => {
      const evidence = getSeedEvidence('r2');
      const plan = await formFillingAgent.generate_population_plan(
        'internship_onboarding',
        'r2',
        evidence,
        {
          work_location: {
            value: 'Bangalore',
            evidenceId: evidence.find((e) => e.value === 'Bangalore')!.evidenceId,
            sourceDocument: 'Internship_Offer_Letter.pdf',
            sourceLocation: 'Page 1, Paragraph 2',
            confidence: 0.98
          }
        }
      );
      expect(plan.mappings.length).toBe(6);
      const location = plan.mappings.find((m) => m.canonicalField === 'work_location');
      expect(location?.value).toBe('Bangalore');
      const constraints = await formFillingAgent.validate_field_constraints(plan);
      expect(constraints.valid).toBe(true);
    });

    it('denies submit_form without human approval, allows it with approval + valid action hash', async () => {
      const denied = await formFillingAgent.evaluate_authorization('Action::"submit_form"', {
        conflict_resolved: true,
        evidence_confidence: 0.98,
        human_approved: false,
        workflow_scope: 'internship_onboarding'
      });
      expect(denied.decision).toBe('DENY');

      const allowed = await formFillingAgent.evaluate_authorization('Action::"submit_form"', {
        conflict_resolved: true,
        evidence_confidence: 0.98,
        human_approved: true,
        action_hash_valid: true,
        workflow_scope: 'internship_onboarding'
      });
      expect(allowed.decision).toBe('ALLOW');
    });
  });
});
