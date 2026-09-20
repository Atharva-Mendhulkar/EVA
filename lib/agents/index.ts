// EVA 4 Bounded Agents (PRD Section 5, ADR-002)
// Orchestrator, Employment Domain, Evidence, Form Filling.
// Agents-as-tools composition: each agent exposes its PRD tools as methods and
// the Orchestrator coordinates them. These classes ARE the bounded agent
// interface — the Strands SDK wraps them at deploy time, so no SDK dependency
// is needed to define, test, or run the contract.

import { cedarEngine } from '../cedar/engine';
import { extractEvidenceWithBedrock, invokeBedrock } from '../bedrock/extractor';
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

export type DomainType =
  | 'employment'
  | 'government'
  | 'healthcare'
  | 'finance'
  | 'education'
  | 'legal';

export interface WorkflowRecommendation {
  domain: DomainType;
  identifiedGoal: string;
  options: {
    title: string;
    description: string;
    readiness: 'READY' | 'MISSING_DOCS' | 'ACTION_REQUIRED';
  }[];
  requiredPrerequisites: string[];
  missingPrerequisites: string[];
  nextSteps: string[];
}

export interface IDomainAgent {
  readonly domain: DomainType;
  readonly name: string;
  readonly principal: CedarPrincipal;
  readonly systemPrompt: string;
  get_required_fields(template: string): Promise<CanonicalField[]>;
  validate_document_checklist(
    template: string,
    availableDocumentIds: string[]
  ): Promise<{ met: string[]; missing: string[] }>;
  compile_domain_plan(template: string, intent: string): Promise<WorkflowStep[]>;
  get_recommendations(intent: string, currentEvidence?: Evidence[]): Promise<WorkflowRecommendation>;
}

// ─── 1. EVA Orchestrator ─────────────────────────────────────────────────────

export class EvaOrchestrator {
  public readonly name = 'orchestrator';
  public readonly principal: CedarPrincipal = 'EvaAgent::"orchestrator"';
  public readonly systemPrompt = `You are the EVA Orchestrator. Decompose natural-language intent, discover applicable workflows, match domain agents, and coordinate lifecycle steps. You never authorize actions or read document plaintext.`;

  public async classify_intent(text: string): Promise<{ template: string; confidence: number }> {
    const bedrockPrompt = `Classify this user administrative request into one of these templates: [internship_onboarding, hardware_procurement, medical_reimbursement, vendor_payout_update, custom_operation]. Respond with strict JSON format only: {"template": "...", "confidence": 0.95}\n\nRequest: "${text}"`;
    const llmRes = await invokeBedrock(bedrockPrompt, this.systemPrompt);
    if (llmRes) {
      try {
        const parsed = JSON.parse(llmRes.trim());
        if (parsed.template && typeof parsed.confidence === 'number') {
          return { template: parsed.template, confidence: parsed.confidence };
        }
      } catch {}
    }
    const template = classifyIntent(text || '');
    if (template === 'custom_operation') {
      return { template, confidence: 0.5 };
    }
    return { template, confidence: template === 'internship_onboarding' ? 0.95 : 0.98 };
  }

  public async select_domain_agent(template: string): Promise<DomainType> {
    const config = TEMPLATES[template];
    if (!config) throw new Error(`No domain agent for template "${template}".`);
    switch (config.category) {
      case 'government':
        return 'government';
      case 'medical':
        return 'healthcare';
      case 'financial':
      case 'procurement':
        return 'finance';
      case 'education':
        return 'education';
      case 'legal':
        return 'legal';
      case 'onboarding':
      default:
        return 'employment';
    }
  }

  public get_domain_agent(domain: DomainType): IDomainAgent {
    return domainRegistry.get(domain);
  }

  public async get_workflow_recommendations(
    intent: string,
    template?: string,
    availableDocIds: string[] = []
  ): Promise<WorkflowRecommendation> {
    const resolvedTemplate = template || (await this.classify_intent(intent)).template;
    const domain = await this.select_domain_agent(resolvedTemplate);
    return workflowPlanningAgent.plan_workflow_options(intent, domain, availableDocIds);
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

// ─── 2. Domain Agents ────────────────────────────────────────────────────────

interface DomainPlanConfig {
  understand: string;
  gather: string;
  extract: string;
  reconcile: string;
  authorize: string;
  populate: string;
  approval: string;
  submit: string;
}

export abstract class BaseDomainAgent implements IDomainAgent {
  constructor(
    public readonly domain: DomainType,
    public readonly name: string,
    public readonly principal: CedarPrincipal,
    public readonly systemPrompt: string,
    public readonly refusalCanary: CanonicalField,
    public readonly defaultTemplate: string,
    private readonly planDetails: DomainPlanConfig
  ) {}

  public async get_required_fields(template: string): Promise<CanonicalField[]> {
    const config = TEMPLATES[template] || TEMPLATES[this.defaultTemplate];
    if (!config) throw new Error(`Unknown template "${template}".`);
    return [...config.fieldSchema.map((f) => f.field), this.refusalCanary];
  }

  public async validate_document_checklist(
    template: string,
    availableDocumentIds: string[]
  ): Promise<{ met: string[]; missing: string[] }> {
    const config = TEMPLATES[template] || TEMPLATES[this.defaultTemplate];
    if (!config) throw new Error(`Unknown template "${template}".`);
    const available = new Set(availableDocumentIds);
    return {
      met: config.documentIds.filter((id) => available.has(id)),
      missing: config.documentIds.filter((id) => !available.has(id))
    };
  }

  public async compile_domain_plan(template: string, intent: string): Promise<WorkflowStep[]> {
    const config = TEMPLATES[template] || TEMPLATES[this.defaultTemplate] || TEMPLATES['internship_onboarding'];
    const count = String(config.documentIds?.length ?? 0);
    const target = config.targetSystem || 'target system';
    return [
      { stepId: 1, name: 'Understand request', status: 'COMPLETED', detail: this.planDetails.understand.replace('{title}', config.title) },
      { stepId: 2, name: 'Gather documents', status: 'IN_PROGRESS', detail: this.planDetails.gather.replace('{count}', count) },
      { stepId: 3, name: 'Extract evidence', status: 'PENDING', detail: this.planDetails.extract },
      { stepId: 4, name: 'Reconcile information', status: 'PENDING', detail: this.planDetails.reconcile },
      { stepId: 5, name: 'Authorize actions', status: 'PENDING', detail: this.planDetails.authorize },
      { stepId: 6, name: 'Populate form', status: 'PENDING', detail: this.planDetails.populate.replace('{target}', target) },
      { stepId: 7, name: 'Request approval', status: 'PENDING', detail: this.planDetails.approval },
      { stepId: 8, name: 'Submit', status: 'PENDING', detail: this.planDetails.submit.replace('{target}', target) }
    ];
  }

  public async get_recommendations(intent: string): Promise<WorkflowRecommendation> {
    return workflowPlanningAgent.plan_workflow_options(intent, this.domain);
  }
}

export class EmploymentDomainAgent extends BaseDomainAgent {
  constructor() {
    super(
      'employment',
      'employment',
      'EvaAgent::"employment"',
      'You are the EVA Employment Domain Agent. You handle internship and employment onboarding, offer-letter interpretation, and required credential checklists. You work from metadata and schemas, never raw documents.',
      'bank_account_number',
      'internship_onboarding',
      {
        understand: 'Intent → {title}',
        gather: '{count} required documents',
        extract: 'Evidence Agent structured extraction',
        reconcile: 'Deterministic comparator',
        authorize: 'Cedar PDP evaluation',
        populate: 'Form Filling Agent plan for {target}',
        approval: 'Action-bound human approval gate',
        submit: 'Consequential dispatch to {target}'
      }
    );
  }
}

export class GovernmentBureaucracyAgent extends BaseDomainAgent {
  constructor() {
    super(
      'government',
      'government',
      'EvaAgent::"government"',
      'You are the EVA Government & Bureaucracy Agent. You understand civic registration, municipal filings, and regulatory compliance. You enforce strict identity grounding and zero-hallucination boundary checks.',
      'tax_identification_number',
      'government_civic_clearance',
      {
        understand: 'Citizen Goal → {title}',
        gather: 'Statutory proof of identity and residence',
        extract: 'Structured extraction of official records',
        reconcile: 'Jurisdiction & address alignment',
        authorize: 'Cedar PDP statutory authorization',
        populate: 'Prepare filing for {target}',
        approval: 'Citizen explicit sign-off',
        submit: 'Submission to government endpoint'
      }
    );
  }
}

export class HealthcareAdminAgent extends BaseDomainAgent {
  constructor() {
    super(
      'healthcare',
      'healthcare',
      'EvaAgent::"healthcare"',
      'You are the EVA Healthcare Administration Agent. You understand health insurance reimbursement, clinical admission documentation, and pharmacy invoices.',
      'patient_medical_record_number',
      'medical_reimbursement',
      {
        understand: 'Clinical Goal → {title}',
        gather: 'Hospital bill & physician summary',
        extract: 'Itemized extraction of clinical charges',
        reconcile: 'Admission and discharge date check',
        authorize: 'Cedar PDP insurance policy compliance',
        populate: 'TPA portal claim preparation',
        approval: 'Policyholder claim review',
        submit: 'Claim submission to insurance sandbox'
      }
    );
  }
}

export class FinanceProcurementAgent extends BaseDomainAgent {
  constructor() {
    super(
      'finance',
      'finance',
      'EvaAgent::"finance"',
      'You are the EVA Finance & Procurement Agent. You understand corporate payouts, bank routing IFSC reconciliation, and hardware procurement.',
      'corporate_swift_code',
      'vendor_payout_update',
      {
        understand: 'Financial Goal → {title}',
        gather: 'Bank proof & corporate agreement',
        extract: 'IFSC, account, and remit extraction',
        reconcile: 'Banking coordinate verification',
        authorize: 'Cedar PDP financial authorization',
        populate: 'Treasury update preparation',
        approval: 'Authorized signatory sign-off',
        submit: 'Dispatch to banking gateway'
      }
    );
  }
}

export class EducationDomainAgent extends BaseDomainAgent {
  constructor() {
    super(
      'education',
      'education',
      'EvaAgent::"education"',
      'You are the EVA Education Domain Agent. You understand university NOCs, academic transcripts, degree verification, and institutional prerequisites.',
      'student_enrollment_pin',
      'education_credential_verification',
      {
        understand: 'Academic Goal → {title}',
        gather: 'Transcripts & university NOC',
        extract: 'Degree and registration extraction',
        reconcile: 'Academic identity reconciliation',
        authorize: 'Cedar PDP verification',
        populate: 'Registrar submission preparation',
        approval: 'Student confirmation gate',
        submit: 'Submission to academic portal'
      }
    );
  }
}

export class LegalComplianceAgent extends BaseDomainAgent {
  constructor() {
    super(
      'legal',
      'legal',
      'EvaAgent::"legal"',
      'You are the EVA Legal & Compliance Agent. You understand NDA execution, contract terms, privacy disclosures, and statutory compliance.',
      'attorney_client_privilege_token',
      'internship_onboarding',
      {
        understand: 'Compliance Goal → {title}',
        gather: 'Legal agreements & disclosures',
        extract: 'Extraction of binding clauses',
        reconcile: 'Legal entity reconciliation',
        authorize: 'Cedar PDP statutory compliance',
        populate: 'Disclosure filing preparation',
        approval: 'Signatory consent gate',
        submit: 'Dispatch to legal archive'
      }
    );
  }
}

// ─── 3. Recommendation & Workflow Planning Agent ────────────────────────────

export class WorkflowPlanningAgent {
  public readonly name = 'workflow_planning';
  public readonly systemPrompt = `You turn verified user intent and available evidence into actionable workflow recommendations. You answer: What can I do? What are my options? What should I prepare? What is missing? What happens next?`;

  public async plan_workflow_options(
    intent: string,
    domain: DomainType,
    availableDocumentIds: string[] = []
  ): Promise<WorkflowRecommendation> {
    const templateConfig =
      Object.values(TEMPLATES).find((t) => t.category === domain) ||
      TEMPLATES['internship_onboarding'];

    const requiredDocs = templateConfig.documentIds;
    const available = new Set(availableDocumentIds);
    const met = requiredDocs.filter((id) => available.has(id));
    const missing = requiredDocs.filter((id) => !available.has(id));

    return {
      domain,
      identifiedGoal: intent,
      options: [
        {
          title: `Autonomous ${templateConfig.title} Workflow`,
          description: `Execute grounded evidence extraction, Cedar policy evaluation, and sandboxed dispatch to ${templateConfig.targetSystem}.`,
          readiness: missing.length === 0 ? 'READY' : 'MISSING_DOCS'
        },
        {
          title: 'Evidence Verification & Document Inspection',
          description: 'Extract canonical facts and inspect cross-document provenance without external submission.',
          readiness: 'READY'
        }
      ],
      requiredPrerequisites: requiredDocs,
      missingPrerequisites: missing,
      nextSteps: [
        missing.length > 0
          ? `Upload missing credential(s): ${missing.join(', ')}`
          : 'All prerequisite documents verified in vault',
        'Deterministic comparator checks cross-source consistency',
        'Cedar Policy PDP authorizes sandbox field population',
        'Explicit human consent required before final dispatch'
      ]
    };
  }
}

// ─── 4. Domain Agent Registry ───────────────────────────────────────────────

export class DomainAgentRegistry {
  private agents = new Map<DomainType, IDomainAgent>();

  constructor() {
    this.register(new EmploymentDomainAgent());
    this.register(new GovernmentBureaucracyAgent());
    this.register(new HealthcareAdminAgent());
    this.register(new FinanceProcurementAgent());
    this.register(new EducationDomainAgent());
    this.register(new LegalComplianceAgent());
  }

  public register(agent: IDomainAgent) {
    this.agents.set(agent.domain, agent);
  }

  public get(domain: DomainType): IDomainAgent {
    const agent = this.agents.get(domain);
    if (!agent) throw new Error(`Domain agent for "${domain}" not found in registry.`);
    return agent;
  }

  public listDomains(): DomainType[] {
    return Array.from(this.agents.keys());
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
export const governmentAgent = new GovernmentBureaucracyAgent();
export const healthcareAgent = new HealthcareAdminAgent();
export const financeAgent = new FinanceProcurementAgent();
export const educationAgent = new EducationDomainAgent();
export const legalAgent = new LegalComplianceAgent();
export const workflowPlanningAgent = new WorkflowPlanningAgent();
export const evidenceAgent = new EvidenceAgent();
export const formFillingAgent = new FormFillingAgent();
export const domainRegistry = new DomainAgentRegistry();
