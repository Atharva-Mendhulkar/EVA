// NEXUS Core Domain & Engine Types
// Central Product Principle: EVIDENCE -> RECONCILIATION -> AUTHORIZATION -> ACTION -> AUDIT

export type CanonicalField =
  | 'full_name'
  | 'university'
  | 'employer'
  | 'role'
  | 'work_location'
  | 'start_date'
  | 'bank_account_number'; // Used for critical negative hallucination test

export interface Evidence {
  evidenceId: string;
  workflowRunId: string;
  field: CanonicalField;
  value: string;
  sourceDocumentId: string;
  sourceDocumentName: string;
  sourceLocation: string;
  sourceExcerpt: string;
  extractedAt: string;
  documentUpdatedAt: string;
  confidence: number; // 0.00 to 1.00
}

export interface Conflict {
  conflictId: string;
  workflowRunId: string;
  field: CanonicalField;
  candidateEvidence: Evidence[];
  severity: 'critical' | 'informational';
  status: 'open' | 'resolved';
  selectedEvidenceId: string | null;
  overrideValue?: string;
  resolvedBy: 'user' | 'system' | null;
  resolvedAt: string | null;
  comparatorAnalysis: {
    field: string;
    normalizedA: string;
    normalizedB: string;
    comparison: 'DIFFERENT' | 'IDENTICAL';
    result: 'EXECUTION BLOCKED' | 'PASS';
    reason: string;
  };
}

export type CedarPrincipal =
  | 'NexusAgent::"orchestrator"'
  | 'NexusAgent::"document_evidence"'
  | 'NexusAgent::"form_execution"'
  | `User::"${string}"`;

export type CedarAction =
  | 'Action::"read_document"'
  | 'Action::"use_sensitive_document"'
  | 'Action::"populate_form"'
  | 'Action::"submit_form"';

export type CedarResource =
  | 'Form::"internship_onboarding"'
  | `Document::"${string}"`;

export interface CedarContext {
  conflict_resolved: boolean;
  evidence_confidence: number;
  human_approved: boolean;
  workflow_scope: string;
  has_unresolved_critical_conflict?: boolean;
}

export interface PolicyConditionResult {
  name: string;
  required: string;
  actual: string;
  result: 'PASS' | 'FAIL';
}

export interface CedarEvaluationResult {
  decisionId: string;
  principal: CedarPrincipal;
  action: CedarAction;
  resource: CedarResource;
  decision: 'ALLOW' | 'DENY';
  reason: string;
  policySnippet: string;
  policyId: string;
  conditions: PolicyConditionResult[];
  whatWouldChange: {
    condition: string;
    from: string;
    to: string;
    outcomeWouldBecome: 'ALLOW' | 'DENY';
  };
  evaluatedAt: string;
}

export interface DecisionExplanation {
  decisionId: string;
  workflowRunId?: string;
  action: string;
  outcome: 'ALLOW' | 'DENY' | 'CONFLICT' | 'APPROVAL_REQUIRED' | 'REFUSAL' | 'SUCCESS';
  summary: string;
  whyStopped?: string;
  evidenceRefs: string[];
  policyRefs: string[];
  conditions: PolicyConditionResult[];
  actor: string;
  timestamp: string;
  nextAction: string;
  whatWouldChange?: string;
}

export interface AuditEvent {
  eventId: string;
  workflowRunId: string;
  timestamp: string;
  actor: string;
  action: string;
  decision: 'INFO' | 'WARN' | 'ALLOW' | 'DENY' | 'RESOLVE' | 'APPROVE' | 'SUCCESS' | 'BLOCKED';
  reason: string;
  resource?: string;
  cryptographicHash?: string;
  evidenceRefs?: string[];
  explanation?: DecisionExplanation;
}

export type WorkflowStatus =
  | 'IDLE'
  | 'PLANNING'
  | 'EXTRACTING'
  | 'AWAITING_USER_RESOLUTION'
  | 'AUTHORIZING_POPULATION'
  | 'POPULATING_FORM'
  | 'AWAITING_HUMAN_APPROVAL'
  | 'AUTHORIZING_SUBMISSION_POST'
  | 'SUBMITTING_FORM'
  | 'COMPLETED'
  | 'FAILED';

export type AwaitingAction = 'CONFLICT_RESOLUTION' | 'HUMAN_APPROVAL' | null;

export interface WorkflowStep {
  stepId: number;
  name: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'ATTENTION' | 'FAILED';
  detail?: string;
}

export interface FormField {
  fieldId: string;
  canonicalField: CanonicalField;
  label: string;
  value: string;
  sourceDocument: string;
  sourceLocation: string;
  confidence: number;
  evidenceId: string;
  userConfirmed?: boolean;
  status: 'empty' | 'populating' | 'verified';
}

export interface WorkflowRun {
  workflowRunId: string;
  userId: string;
  intent: string;
  template: string;
  status: WorkflowStatus;
  currentStep: string;
  stepIndex: number;
  awaitingAction: AwaitingAction;
  plan: WorkflowStep[];
  evidence: Evidence[];
  conflicts: Conflict[];
  auditTrail: AuditEvent[];
  cedarDecisions: CedarEvaluationResult[];
  formFields: FormField[];
  latestExplanation?: DecisionExplanation;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentMetadata {
  documentId: string;
  name: string;
  sizeBytes: number;
  updatedAt: string;
  type: string;
  sensitivity: 'standard' | 'financial' | 'identity';
  description: string;
}
