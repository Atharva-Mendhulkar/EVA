// EVA 4 Bounded Agents (PRD Section 5, ADR-002)
// Orchestrator, Employment Domain, Evidence, Form Filling.
// Agents-as-tools composition: each agent exposes its PRD tools as methods and
// the Orchestrator coordinates them. These classes ARE the bounded agent
// interface — the Strands SDK wraps them at deploy time, so no SDK dependency
// is needed to define, test, or run the contract.

import { cedarEngine } from '../cedar/engine';
import { extractEvidenceWithBedrock } from '../bedrock/extractor';
import { detectConflicts } from '../engine/comparator';
import { TEMPLATES } from '../engine/fixtures';
import { buildPopulationPlan, FieldResolution } from '../engine/form-plan';
import { classifyIntent, workflowStore } from '../engine/state-machine';
import { verifyAuditChain } from '../audit/chain';
import {
  CanonicalField,
  CedarAction,
  CedarContext,
  CedarEvaluationResult,
  CedarPrincipal,
  Conflict,
  Evidence,
  FormPopulationPlan,
  WorkflowRun,
  WorkflowStep
} from '../engine/types';

// ─── 1. EVA Orchestrator ─────────────────────────────────────────────────────

export class EvaOrchestrator {
  public readonly name = 'orchestrator';
  public readonly principal: CedarPrincipal = 'EvaAgent::"orchestrator"';
  public readonly systemPrompt = `You are the EVA Orchestrator. Decompose natural-language intent, match the domain agent, and coordinate lifecycle steps. You never authorize actions or read document plaintext.`;

  public async classify_intent(text: string): Promise<{ template: string; confidence: number }> {
    const template = classifyIntent(text || '');
    if (template === 'custom_operation') {
      return { template, confidence: 0.5 };
    }
    return { template, confidence: template === 'internship_onboarding' ? 0.95 : 0.98 };
  }

  public async select_domain_agent(template: string): Promise<'employment'> {
    if (!TEMPLATES[template]) throw new Error(`No domain agent for template "${template}".`);
    return 'employment';
  }

  public async initiate_workflow_plan(intent: string, userId = 'usr_eva_admin'): Promise<WorkflowRun> {
    const { template, confidence } = await this.classify_intent(intent);
    if (confidence < 0.7) {
      throw new Error(`Intent confidence ${confidence} below 0.70 floor. Refusing to start workflow.`);
    }
    await this.select_domain_agent(template);
    return workflowStore.createWorkflow(intent, template, userId);
  }

  public async report_progress(runId: string): Promise<{
    status: string;
    currentStep: string;
    stepIndex: number;
    awaitingAction: string | null;
  }> {
    const run = workflowStore.getWorkflow(runId);
    if (!run) throw new Error(`Workflow run ${runId} not found.`);
    return {
      status: run.status,
      currentStep: run.currentStep,
      stepIndex: run.stepIndex,
      awaitingAction: run.awaitingAction
    };
  }

  public async resolve_and_populate(
    runId: string,
    conflictId: string,
    evidenceId: string,
    override?: string
  ): Promise<WorkflowRun> {
    return workflowStore.resolveConflict(runId, conflictId, evidenceId, override);
  }

  public async approve_and_submit(
    runId: string,
    decision: 'APPROVE' | 'REJECT' = 'APPROVE',
    notes?: string,
    nonce?: string
  ): Promise<WorkflowRun> {
    return workflowStore.approveSubmission(runId, decision, notes, nonce);
  }

  public async audit_and_verify(runId: string): Promise<{ valid: boolean; checked: number }> {
    const run = workflowStore.getWorkflow(runId);
    if (!run) throw new Error(`Workflow run ${runId} not found.`);
    const { valid, checked } = verifyAuditChain(run.auditTrail);
    return { valid, checked };
  }
}

// ─── 2. Employment Domain Agent ─────────────────────────────────────────────

export class EmploymentDomainAgent {
  public readonly name = 'employment';
  public readonly principal: CedarPrincipal = 'EvaAgent::"employment"';
  public readonly systemPrompt = `You are the EVA Employment Domain Agent. You know onboarding requirements: required canonical fields and document prerequisites. You work from metadata and schemas, never raw documents.`;

  /** Canonical requirements plus the refusal canary (PRD Section 5.2). */
  public async get_required_fields(template: string): Promise<CanonicalField[]> {
    const config = TEMPLATES[template];
    if (!config) throw new Error(`Unknown template "${template}".`);
    return [...config.fieldSchema.map((f) => f.field), 'bank_account_number'];
  }

  public async validate_document_checklist(
    template: string,
    availableDocumentIds: string[]
  ): Promise<{ met: string[]; missing: string[] }> {
    const config = TEMPLATES[template];
    if (!config) throw new Error(`Unknown template "${template}".`);
    const available = new Set(availableDocumentIds);
    return {
      met: config.documentIds.filter((id) => available.has(id)),
      missing: config.documentIds.filter((id) => !available.has(id))
    };
  }

  public async compile_domain_plan(template: string, intent: string): Promise<WorkflowStep[]> {
    const config = TEMPLATES[template] || TEMPLATES['internship_onboarding'];
    return [
      { stepId: 1, name: 'Understand request', status: 'COMPLETED', detail: `Intent → ${config.title}` },
      { stepId: 2, name: 'Gather documents', status: 'IN_PROGRESS', detail: `${config.documentIds.length} required documents` },
      { stepId: 3, name: 'Extract evidence', status: 'PENDING', detail: 'Evidence Agent structured extraction' },
      { stepId: 4, name: 'Reconcile information', status: 'PENDING', detail: 'Deterministic comparator' },
      { stepId: 5, name: 'Authorize actions', status: 'PENDING', detail: 'Cedar PDP evaluation' },
      { stepId: 6, name: 'Populate form', status: 'PENDING', detail: `Form Filling Agent plan for ${config.targetSystem}` },
      { stepId: 7, name: 'Request approval', status: 'PENDING', detail: 'Action-bound human approval gate' },
      { stepId: 8, name: 'Submit', status: 'PENDING', detail: `Consequential dispatch to ${config.targetSystem}` }
    ];
  }
}

// ─── 3. Evidence Agent ───────────────────────────────────────────────────────

export class EvidenceAgent {
  public readonly name = 'evidence';
  public readonly principal: CedarPrincipal = 'EvaAgent::"evidence"';
  public readonly systemPrompt = `You are the EVA Evidence Agent. Extract structured fields via Amazon Bedrock inside <untrusted_document_data> guardrails. Emit null with 0.0 confidence for absent fields. Never resolve discrepancies.`;

  public async extract_canonical_fields(
    documentName: string,
    rawText: string,
    fields: CanonicalField[],
    workflowRunId = 'active_run'
  ): Promise<Evidence[]> {
    const result = await extractEvidenceWithBedrock(documentName, rawText, fields);
    return result.extractedFields.map((f, idx) => ({
      evidenceId: `ev_${documentName}_${f.field}_${idx}`,
      workflowRunId,
      field: f.field,
      value: f.value ?? '',
      sourceDocumentId: documentName,
      sourceDocumentName: result.documentName,
      sourceLocation: f.sourceLocation,
      sourceExcerpt: f.sourceExcerpt,
      extractedAt: new Date().toISOString(),
      documentUpdatedAt: result.documentDate,
      confidence: f.confidence,
      provenanceStatus: 'SOURCE_BACKED' as const,
      extractionMethod: result.mode
    }));
  }

  public async detect_same_source_contradictions(
    workflowRunId: string,
    evidenceList: Evidence[]
  ): Promise<{ conflicts: Conflict[]; hasCriticalConflict: boolean }> {
    return detectConflicts(workflowRunId, evidenceList);
  }

  public async refuse_missing_field(field: CanonicalField, reason: string): Promise<Evidence> {
    return {
      evidenceId: `ev_refusal_${field}_${Date.now()}`,
      workflowRunId: 'active_run',
      field,
      value: '',
      sourceDocumentId: 'none',
      sourceDocumentName: 'N/A',
      sourceLocation: 'Corpus Scan Exhaustive',
      sourceExcerpt: `Field absent: ${reason}. Zero-hallucination refusal enforced per PRD Section 18.3.`,
      extractedAt: new Date().toISOString(),
      documentUpdatedAt: new Date().toISOString(),
      confidence: 0.0
    };
  }
}

// ─── 4. Form Filling Agent ───────────────────────────────────────────────────

export class FormFillingAgent {
  public readonly name = 'form_filling';
  public readonly principal: CedarPrincipal = 'EvaAgent::"form_filling"';
  public readonly systemPrompt = `You are the EVA Form Filling Agent. Map resolved evidence to target form schemas and emit an executable FormPopulationPlan. Every mapped value references a valid evidenceId. You never touch the browser or approve submissions.`;

  public async inspect_form_schema(
    template: string
  ): Promise<{ field: CanonicalField; label: string }[]> {
    const config = TEMPLATES[template];
    if (!config) throw new Error(`Unknown template "${template}".`);
    return config.fieldSchema;
  }

  public async generate_population_plan(
    formId: string,
    workflowRunId: string,
    evidence: Evidence[],
    resolutions: Partial<Record<CanonicalField, FieldResolution>> = {}
  ): Promise<FormPopulationPlan> {
    const schema = await this.inspect_form_schema(formId);
    return buildPopulationPlan(formId, workflowRunId, schema, evidence, resolutions).plan;
  }

  public async validate_field_constraints(
    plan: FormPopulationPlan
  ): Promise<{ valid: boolean; violations: string[] }> {
    const violations: string[] = [];
    for (const m of plan.mappings) {
      if (!m.evidenceId) violations.push(`Mapping ${m.formField} has no evidenceId.`);
      if ((!m.value || m.value === 'N/A') && !plan.missingFields.includes(m.formField)) {
        violations.push(`Mapping ${m.formField} is ungrounded but not listed in missingFields.`);
      }
    }
    return { valid: violations.length === 0, violations };
  }

  public async evaluate_authorization(
    action: CedarAction,
    context: CedarContext,
    resource?: `Form::"${string}"`
  ): Promise<CedarEvaluationResult> {
    return cedarEngine.evaluate(
      this.principal,
      action,
      resource ?? (`Form::"${context.workflow_scope}"` as `Form::"${string}"`),
      context
    );
  }
}

// ─── Singletons ──────────────────────────────────────────────────────────────

export const orchestratorAgent = new EvaOrchestrator();
export const employmentAgent = new EmploymentDomainAgent();
export const evidenceAgent = new EvidenceAgent();
export const formFillingAgent = new FormFillingAgent();
