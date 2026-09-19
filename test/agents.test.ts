import { describe, it, expect } from 'vitest';
import {
  orchestratorAgent,
  employmentAgent,
  governmentAgent,
  healthcareAgent,
  financeAgent,
  educationAgent,
  legalAgent,
  workflowPlanningAgent,
  evidenceAgent,
  formFillingAgent,
  domainRegistry
} from '../lib/agents';
import { getSeedEvidence } from '../lib/engine/fixtures';
import { populateFormFields, submitPopulatedForm } from '../lib/playwright/executor';

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

  describe('5. Multi-Domain Agents & Domain Registry', () => {
    it('registers all enterprise domain agents in the DomainAgentRegistry', () => {
      const domains = domainRegistry.listDomains();
      expect(domains).toContain('employment');
      expect(domains).toContain('government');
      expect(domains).toContain('healthcare');
      expect(domains).toContain('finance');
      expect(domains).toContain('education');
      expect(domains).toContain('legal');
    });

    it('routes orchestrator domain selection to proper domain agents', async () => {
      expect(await orchestratorAgent.select_domain_agent('internship_onboarding')).toBe('employment');
      expect(await orchestratorAgent.select_domain_agent('government_civic_clearance')).toBe('government');
      expect(await orchestratorAgent.select_domain_agent('medical_reimbursement')).toBe('healthcare');
      expect(await orchestratorAgent.select_domain_agent('hardware_procurement')).toBe('finance');
      expect(await orchestratorAgent.select_domain_agent('vendor_payout_update')).toBe('finance');
      expect(await orchestratorAgent.select_domain_agent('education_credential_verification')).toBe('education');
    });

    it('government agent enforces statutory refusal canary tax_identification_number', async () => {
      const fields = await governmentAgent.get_required_fields('government_civic_clearance');
      expect(fields).toContain('full_name');
      expect(fields).toContain('tax_identification_number');
      const plan = await governmentAgent.compile_domain_plan('government_civic_clearance', 'Citizen filing');
      expect(plan).toHaveLength(8);
      expect(plan[0].detail).toContain('Citizen Goal');
    });

    it('healthcare agent enforces patient_medical_record_number refusal canary', async () => {
      const fields = await healthcareAgent.get_required_fields('medical_reimbursement');
      expect(fields).toContain('patient_medical_record_number');
    });

    it('finance agent enforces corporate_swift_code refusal canary', async () => {
      const fields = await financeAgent.get_required_fields('vendor_payout_update');
      expect(fields).toContain('corporate_swift_code');
    });

    it('education agent enforces student_enrollment_pin refusal canary', async () => {
      const fields = await educationAgent.get_required_fields('education_credential_verification');
      expect(fields).toContain('student_enrollment_pin');
    });

    it('legal agent enforces attorney_client_privilege_token refusal canary', async () => {
      const fields = await legalAgent.get_required_fields('internship_onboarding');
      expect(fields).toContain('attorney_client_privilege_token');
    });
  });

  describe('6. Recommendation & Workflow Planning Agent', () => {
    it('generates actionable options answering what can I do and what is missing', async () => {
      const rec = await workflowPlanningAgent.plan_workflow_options(
        'Starting an internship in Bangalore',
        'employment',
        ['doc_profile_01']
      );
      expect(rec.domain).toBe('employment');
      expect(rec.options.length).toBeGreaterThanOrEqual(2);
      expect(rec.missingPrerequisites).toContain('doc_offer_03');
      expect(rec.nextSteps.some((s) => s.includes('missing'))).toBe(true);
    });

    it('orchestrator provides unified workflow recommendations', async () => {
      const rec = await orchestratorAgent.get_workflow_recommendations(
        'Need to file municipal civic permit',
        'government_civic_clearance'
      );
      expect(rec.domain).toBe('government');
      expect(rec.options[0].title).toContain('Government Civic Clearance');
    });
  });

  describe('7. Playwright Execution Agent (PRD Section 10)', () => {
    it('populates form fields and computes deterministic formStateHash', () => {
      const fields = [
        {
          fieldId: 'f1',
          canonicalField: 'full_name' as const,
          label: 'Full Name',
          value: 'Atharva Mendhulkar',
          sourceDocument: 'Profile.pdf',
          sourceLocation: 'Page 1',
          confidence: 0.98,
          evidenceId: 'ev_1',
          status: 'verified' as const
        },
        {
          fieldId: 'f2',
          canonicalField: 'work_location' as const,
          label: 'Work Location',
          value: 'Bangalore',
          sourceDocument: 'Offer.pdf',
          sourceLocation: 'Page 1',
          confidence: 0.99,
          evidenceId: 'ev_2',
          status: 'verified' as const
        }
      ];
      const result = populateFormFields('internship_onboarding', fields);
      expect(result.formId).toBe('internship_onboarding');
      expect(result.fieldsPopulated).toBe(2);
      expect(result.formStateHash).toHaveLength(64);
    });

    it('emits verified submission receipt when receipt is parsed', () => {
      const receipt = submitPopulatedForm(
        'internship_onboarding',
        'https://mock-company-portal.internal/onboard',
        6,
        true
      );
      expect(receipt.statusCode).toBe(200);
      expect(receipt.receiptId).toMatch(/^rcpt_/);
      expect(receipt.fieldsSubmitted).toBe(6);
      expect(receipt.message).toContain('Authorization boundary verified');
    });

    it('enforces unknown-submission guard forbidding retries when no receipt parsed', () => {
      const receipt = submitPopulatedForm(
        'internship_onboarding',
        'https://mock-company-portal.internal/onboard',
        6,
        false
      );
      expect(receipt.statusCode).toBe(0);
      expect(receipt.receiptId).toMatch(/^unknown_/);
      expect(receipt.message).toContain('SUBMISSION_STATUS_UNKNOWN: no receipt parsed. Automated retries forbidden.');
      expect(receipt.fieldsSubmitted).toBe(0);
    });
  });
});

