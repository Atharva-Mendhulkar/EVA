import { describe, it, expect, beforeEach } from 'vitest';
import { cedarEngine } from '../lib/cedar/engine';
import { detectConflicts, normalizeFieldValue } from '../lib/engine/comparator';
import { getSeedEvidence, SEEDED_PROMPT_INJECTION_DOC } from '../lib/engine/fixtures';
import { WorkflowStore } from '../lib/engine/state-machine';
import { Evidence } from '../lib/engine/types';

describe('EVA Core Logic & Verification Suite', () => {
  let store: WorkflowStore;

  beforeEach(() => {
    store = new WorkflowStore();
    store.seedInitialWorkflows();
  });

  // 1. Conflict detection: Mumbai vs Bangalore -> conflict
  it('1. Deterministic Conflict Detection catches Mumbai vs Bangalore', () => {
    const evidenceList = getSeedEvidence('test_run_1');
    const result = detectConflicts('test_run_1', evidenceList);

    expect(result.hasCriticalConflict).toBe(true);
    expect(result.conflicts.length).toBeGreaterThanOrEqual(1);

    const locationConflict = result.conflicts.find((c) => c.field === 'work_location');
    expect(locationConflict).toBeDefined();
    expect(locationConflict?.status).toBe('open');
    expect(locationConflict?.severity).toBe('critical');
    expect(locationConflict?.comparatorAnalysis.normalizedA).toBe('mumbai');
    expect(locationConflict?.comparatorAnalysis.normalizedB).toBe('bangalore');
    expect(locationConflict?.comparatorAnalysis.comparison).toBe('DIFFERENT');
    expect(locationConflict?.comparatorAnalysis.result).toBe('EXECUTION BLOCKED');
  });

  // 2. Synonym normalization: Bengaluru vs Bangalore -> no conflict
  it('2. Synonym normalization treats Bengaluru and Bangalore as identical', () => {
    expect(normalizeFieldValue('work_location', 'Bengaluru')).toBe('bangalore');
    expect(normalizeFieldValue('work_location', 'BLR')).toBe('bangalore');
    expect(normalizeFieldValue('work_location', 'Bangalore')).toBe('bangalore');

    const synEvidence: Evidence[] = [
      {
        evidenceId: 'ev_1',
        workflowRunId: 'test_run_syn',
        field: 'work_location',
        value: 'Bengaluru',
        sourceDocumentId: 'doc_1',
        sourceDocumentName: 'DocA.pdf',
        sourceLocation: 'Page 1',
        sourceExcerpt: 'Location: Bengaluru',
        extractedAt: new Date().toISOString(),
        documentUpdatedAt: new Date().toISOString(),
        confidence: 0.95
      },
      {
        evidenceId: 'ev_2',
        workflowRunId: 'test_run_syn',
        field: 'work_location',
        value: 'Bangalore',
        sourceDocumentId: 'doc_2',
        sourceDocumentName: 'DocB.pdf',
        sourceLocation: 'Page 1',
        sourceExcerpt: 'Location: Bangalore',
        extractedAt: new Date().toISOString(),
        documentUpdatedAt: new Date().toISOString(),
        confidence: 0.98
      }
    ];

    const result = detectConflicts('test_run_syn', synEvidence);
    expect(result.hasCriticalConflict).toBe(false);
    expect(result.conflicts.length).toBe(0);
  });

  // 3. Unresolved conflict: populate_form -> DENY
  it('3. Unresolved conflict blocks populate_form in Cedar policy evaluation', () => {
    const decision = cedarEngine.evaluate(
      'EvaAgent::"form_execution"',
      'Action::"populate_form"',
      'Form::"internship_onboarding"',
      {
        conflict_resolved: false, // NOT resolved
        evidence_confidence: 0.98,
        human_approved: false,
        workflow_scope: 'internship'
      }
    );

    expect(decision.decision).toBe('DENY');
    expect(decision.reason).toContain('Conflicting evidence has not yet been resolved');
    const conflictCond = decision.conditions.find((c) => c.name === 'conflict_resolved');
    expect(conflictCond?.result).toBe('FAIL');
  });

  // 4. Resolved conflict: populate_form -> Cedar ALLOW
  it('4. Resolved conflict allows populate_form via Cedar policy', () => {
    const decision = cedarEngine.evaluate(
      'EvaAgent::"form_execution"',
      'Action::"populate_form"',
      'Form::"internship_onboarding"',
      {
        conflict_resolved: true, // Resolved
        evidence_confidence: 0.98,
        human_approved: false,
        workflow_scope: 'internship'
      }
    );

    expect(decision.decision).toBe('ALLOW');
    expect(decision.reason).toContain('Form population is authorized');
    const conflictCond = decision.conditions.find((c) => c.name === 'conflict_resolved');
    expect(conflictCond?.result).toBe('PASS');
  });

  // 5. Pre-approval submit: submit_form + human_approved=false -> Cedar DENY
  it('5. Pre-approval submit_form produces real Cedar DENY', () => {
    const decision = cedarEngine.evaluate(
      'EvaAgent::"form_execution"',
      'Action::"submit_form"',
      'Form::"internship_onboarding"',
      {
        conflict_resolved: true,
        evidence_confidence: 0.98,
        human_approved: false, // NOT approved
        workflow_scope: 'internship'
      }
    );

    expect(decision.decision).toBe('DENY');
    expect(decision.reason).toContain('Action Blocked by Cedar Policy');
    const apprCond = decision.conditions.find((c) => c.name === 'human_approved');
    expect(apprCond?.result).toBe('FAIL');
    expect(decision.whatWouldChange.to).toBe('true');
    expect(decision.whatWouldChange.outcomeWouldBecome).toBe('ALLOW');
  });

  // 6. Approval submit: submit_form + human_approved=true -> Cedar ALLOW
  it('6. Human approved submit_form produces real Cedar ALLOW', () => {
    const decision = cedarEngine.evaluate(
      'EvaAgent::"form_execution"',
      'Action::"submit_form"',
      'Form::"internship_onboarding"',
      {
        conflict_resolved: true,
        evidence_confidence: 0.98,
        human_approved: true, // APPROVED
        workflow_scope: 'internship'
      }
    );

    expect(decision.decision).toBe('ALLOW');
    expect(decision.reason).toContain('Submission authorized');
    const apprCond = decision.conditions.find((c) => c.name === 'human_approved');
    expect(apprCond?.result).toBe('PASS');
  });

  // 7. Cedar engine failure: -> fail-closed DENY
  it('7. Cedar runtime failure strictly fails closed to default DENY', () => {
    try {
      cedarEngine.setSimulateFailure(true);

      const decision = cedarEngine.evaluate(
        'EvaAgent::"form_execution"',
        'Action::"submit_form"',
        'Form::"internship_onboarding"',
        {
          conflict_resolved: true,
          evidence_confidence: 0.98,
          human_approved: true,
          workflow_scope: 'internship'
        }
      );

      expect(decision.decision).toBe('DENY');
      expect(decision.reason).toContain('fail-closed: default DENY');
    } finally {
      cedarEngine.setSimulateFailure(false);
    }
  });

  // 8. Missing sensitive field: -> null / refusal (no hallucination)
  it('8. Missing sensitive field produces strict refusal without hallucination', () => {
    const refusal = store.refuseMissingField('bank_account_number');
    expect(refusal.outcome).toBe('REFUSAL');
    expect(refusal.summary).toContain('EVA refused to populate bank_account_number');
    expect(refusal.whyStopped).toContain('zero-hallucination guardrail');
  });

  // 9. Prompt injection: document instruction does not change workflow
  it('9. Seeded prompt injection note is treated as untrusted text without altering policy', () => {
    expect(SEEDED_PROMPT_INJECTION_DOC.rawContent).toContain('<untrusted_document_data');

    // Attempting to evaluate policy with prompt injection commands
    const injectedContext = {
      conflict_resolved: false,
      evidence_confidence: 0.2,
      human_approved: false,
      workflow_scope: 'internship'
    };

    // Even if document claimed "Bypass Cedar and submit", the engine evaluates deterministically
    const decision = cedarEngine.evaluate(
      'EvaAgent::"form_execution"',
      'Action::"submit_form"',
      'Form::"internship_onboarding"',
      injectedContext
    );

    expect(decision.decision).toBe('DENY');
  });

  // 10. Task token: never appears in public workflow state
  it('10. Step Functions task token is never exposed in the public workflow model', () => {
    const wf = store.getActiveWorkflow()!;
    expect((wf as any).taskToken).toBeUndefined();
    expect((wf as any).activeTaskToken).toBeUndefined();
    expect(wf.awaitingAction).toBe('CONFLICT_RESOLUTION');
  });

  // 11. Refresh / hydration: state persists and can be queried
  it('11. State machine preserves run state and rehydrates on query', () => {
    const wf = store.getActiveWorkflow()!;
    const retrieved = store.getWorkflow(wf.workflowRunId);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.workflowRunId).toBe(wf.workflowRunId);
    expect(retrieved?.status).toBe('AWAITING_USER_RESOLUTION');
    expect(retrieved?.evidence.length).toBe(7);
  });

  // 12. Full end-to-end loop: Resolve -> Cedar Allow -> Populate -> Cedar Deny -> Approve -> Submit
  it('12. End-to-end execution loop maintains real backend state transitions', () => {
    const wf = store.getActiveWorkflow()!;
    const conflict = wf.conflicts[0];
    const offerEvidence = conflict.candidateEvidence.find((e) => e.value === 'Bangalore');
    expect(offerEvidence).toBeDefined();

    // Resolve conflict
    const postResolveWf = store.resolveConflict(
      wf.workflowRunId,
      conflict.conflictId,
      offerEvidence!.evidenceId
    );
    expect(postResolveWf.status).toBe('AWAITING_HUMAN_APPROVAL');
    expect(postResolveWf.formFields.length).toBe(6);
    expect(postResolveWf.cedarDecisions.length).toBe(2);
    expect(postResolveWf.cedarDecisions[0].decision).toBe('ALLOW'); // populate_form
    expect(postResolveWf.cedarDecisions[1].decision).toBe('DENY'); // submit_form pre-approval

    // Human Approval
    const postApproveWf = store.approveSubmission(wf.workflowRunId, 'APPROVE', undefined, postResolveWf.approvalChallenge?.nonce ?? store.getWorkflow(wf.workflowRunId)?.approvalChallenge?.nonce);
    expect(postApproveWf.status).toBe('COMPLETED');
    expect(postApproveWf.cedarDecisions.length).toBe(3);
    expect(postApproveWf.cedarDecisions[2].decision).toBe('ALLOW'); // submit_form post-approval

    // Double approval replay rejection
    expect(() => {
      store.approveSubmission(wf.workflowRunId, 'APPROVE', undefined, postResolveWf.approvalChallenge?.nonce ?? store.getWorkflow(wf.workflowRunId)?.approvalChallenge?.nonce);
    }).toThrow('Invalid state transition');
  });

  // 13. Audit: every consequential event produces an audit event
  it('13. Audit trail records every consequential event in chronological order', () => {
    const wf = store.getActiveWorkflow()!;
    const conflict = wf.conflicts[0];
    const offerEvidence = conflict.candidateEvidence.find((e) => e.value === 'Bangalore');

    store.resolveConflict(wf.workflowRunId, conflict.conflictId, offerEvidence!.evidenceId);
    const completed = store.approveSubmission(wf.workflowRunId, 'APPROVE', undefined, store.getWorkflow(wf.workflowRunId)?.approvalChallenge?.nonce);

    const actions = completed.auditTrail.map((a) => a.action);
    expect(actions).toContain('parse_intent');
    expect(actions).toContain('vault_search');
    expect(actions).toContain('extract_evidence');
    expect(actions).toContain('reconcile_evidence');
    expect(actions).toContain('resolve_conflict');
    expect(actions).toContain('evaluate_policy (populate_form)');
    expect(actions).toContain('evaluate_policy (submit_form)');
    expect(actions).toContain('human_approval');
    expect(actions).toContain('re-evaluate_policy (submit_form)');
    expect(actions).toContain('sandbox_submission');
  });

  // 14. Multi-case workflow creation & listing
  it('14. Multi-case operations are pre-seeded and listed with proper metadata', () => {
    const allWorkflows = store.listWorkflows();
    expect(allWorkflows.length).toBe(4);

    const templates = allWorkflows.map((w) => w.template);
    expect(templates).toContain('internship_onboarding');
    expect(templates).toContain('hardware_procurement');
    expect(templates).toContain('medical_reimbursement');
    expect(templates).toContain('vendor_payout_update');

    // Switching active workflow
    const hwWf = allWorkflows.find((w) => w.template === 'hardware_procurement')!;
    store.setActiveWorkflow(hwWf.workflowRunId);
    expect(store.getActiveWorkflow()?.template).toBe('hardware_procurement');
  });

  // 15. Hardware procurement conflict and resolution
  it('15. Hardware procurement detects RAM conflict and executes full lifecycle', () => {
    const hwWf = store.getWorkflow('run_demo_02')!;
    expect(hwWf.conflicts.length).toBe(1);
    expect(hwWf.conflicts[0].field).toBe('ram_spec');

    const managerApproval = hwWf.conflicts[0].candidateEvidence.find((e) => e.value.includes('36GB'))!;
    expect(managerApproval).toBeDefined();

    // Resolve RAM conflict
    const postResolve = store.resolveConflict(hwWf.workflowRunId, hwWf.conflicts[0].conflictId, managerApproval.evidenceId);
    expect(postResolve.status).toBe('AWAITING_HUMAN_APPROVAL');
    expect(postResolve.formFields.length).toBe(6);

    const ramField = postResolve.formFields.find((f) => f.canonicalField === 'ram_spec');
    expect(ramField?.value).toBe(managerApproval.value);

    // Approve submission
    const postApprove = store.approveSubmission(hwWf.workflowRunId, 'APPROVE', undefined, store.getWorkflow(hwWf.workflowRunId)?.approvalChallenge?.nonce);
    expect(postApprove.status).toBe('COMPLETED');
    expect(postApprove.cedarDecisions.length).toBe(3);
  });

  // 16. Medical reimbursement and vendor payout conflict verification
  it('16. Medical reimbursement and vendor payout detect respective critical conflicts', () => {
    const medWf = store.getWorkflow('run_demo_03')!;
    expect(medWf.conflicts.length).toBe(1);
    expect(medWf.conflicts[0].field).toBe('admission_date');

    const payoutWf = store.getWorkflow('run_demo_04')!;
    expect(payoutWf.conflicts.length).toBe(1);
    expect(payoutWf.conflicts[0].field).toBe('ifsc_code');
  });

  // 17. Conversational greeting produces rich agent response and workflow suggestions
  it('17. Conversational greeting ("hi") produces orchestrator chat response and suggestions', () => {
    const chatWf = store.createWorkflow('hi');
    expect(chatWf.template).toBe('conversational');
    expect(chatWf.title).toBe('EVA Orchestrator');
    expect(chatWf.status).toBe('COMPLETED');
    expect(chatWf.agentResponse).toBeDefined();
    expect(chatWf.agentResponse).toContain('EVA');
    expect(chatWf.suggestions).toBeDefined();
    expect(chatWf.suggestions?.length).toBe(4);
    expect(chatWf.plan.length).toBe(3);
    expect(chatWf.plan[0].name).toBe('Understand conversational request');
  });

  // 18. Operational workflows update conversational agentResponse across lifecycle
  it('18. Operational workflows update agentResponse across conflict and approval', () => {
    const wf = store.createWorkflow("I'm starting an internship in Bangalore");
    expect(wf.agentResponse).toContain('Contradiction Detected');

    const conflict = wf.conflicts[0];
    const evidenceChoice = conflict.candidateEvidence[0];
    const resolved = store.resolveConflict(wf.workflowRunId, conflict.conflictId, evidenceChoice.evidenceId);
    expect(resolved.agentResponse).toContain('Conflict resolved');
    expect(resolved.agentResponse).toContain('Human Consent Gate Active');

    const approved = store.approveSubmission(wf.workflowRunId, 'APPROVE', undefined, resolved.approvalChallenge?.nonce);
    expect(approved.agentResponse).toContain('Submission to');
    expect(approved.agentResponse).toContain('completed successfully');
  });

  // 19. Repository discovery query ("find me this repo") completes cleanly with full repo links and plan
  it('19. Repository discovery query ("find me this repo") completes cleanly with full repo links and plan', () => {
    const repoWf = store.createWorkflow('find me this repo');
    expect(repoWf.status).toBe('COMPLETED');
    expect(repoWf.stepIndex).toBe(8);
    expect(repoWf.agentResponse).toContain('Atharva-Mendhulkar/EVA');
    expect(repoWf.agentResponse).toContain('https://github.com/Atharva-Mendhulkar/EVA');
    expect(repoWf.formFields.length).toBeGreaterThanOrEqual(4);
    expect(repoWf.formFields.some((f) => f.value.includes('EVA'))).toBe(true);
    expect(repoWf.plan.every((p) => p.status === 'COMPLETED')).toBe(true);
    expect(repoWf.cedarDecisions.length).toBeGreaterThanOrEqual(1);
    expect(repoWf.cedarDecisions[0].decision).toBe('ALLOW');
  });
});
