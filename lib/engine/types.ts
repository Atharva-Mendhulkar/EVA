// EVA Core Domain & Engine Types
// Central Product Principle: EVIDENCE -> RECONCILIATION -> AUTHORIZATION -> ACTION -> AUDIT

export type WellKnownCanonicalField =
  // Onboarding
  | 'full_name'
  | 'university'
  | 'employer'
  | 'role'
  | 'work_location'
  | 'start_date'
  // Hardware Procurement
  | 'employee_name'
  | 'device_model'
  | 'ram_spec'
  | 'storage_spec'
  | 'budget_amount'
  | 'department_code'
  // Medical Claim
  | 'patient_name'
  | 'insurance_policy_id'
  | 'hospital_name'
  | 'claim_amount'
  | 'admission_date'
  | 'discharge_date'
  // Vendor Payout
  | 'vendor_name'
  | 'account_number'
  | 'ifsc_code'
  | 'bank_name'
  | 'payout_currency'
  // Negative test field
  | 'bank_account_number';

export type CanonicalField = WellKnownCanonicalField | (string & {});

export interface FormQuestion {
  id: string;
  title: string;
  description?: string;
  type: 'text' | 'textarea' | 'radio' | 'checkbox' | 'dropdown' | 'other';
  entryName?: string; // e.g. "entry.1849201"
  options?: string[];
  required: boolean;
}

export interface FormAccessibilityNode {
  role: 'form' | 'textbox' | 'combobox' | 'radiogroup' | 'checkbox' | 'button' | 'heading';
  name: string;
  selector: string;
  required: boolean;
  type: 'text' | 'textarea' | 'radio' | 'dropdown' | 'checkbox' | 'other';
  entryName?: string;
  options?: string[];
  currentValue?: string;
}

export interface ParsedFormSchema {
  formId: string;
  title: string;
  description?: string;
  actionUrl: string;
  questions: FormQuestion[];
  isGoogleForm: boolean;
  rawUrl: string;
  formType?: 'google_forms' | 'microsoft_forms' | 'web_form';
  accessibilityTree?: FormAccessibilityNode[];
}

export type ProvenanceStatus = 'SOURCE_BACKED' | 'USER_ASSERTED' | 'SYSTEM_DERIVED';

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
  provenanceStatus?: ProvenanceStatus;
  extractionMethod?: string;
}

export interface FieldMapping {
  formField: string;
  canonicalField: CanonicalField;
  evidenceId: string;
  value: string;
  sourceDocumentId: string;
  confidence: number;
  rationale: string;
}

export interface FormPopulationPlan {
  formId: string;
  workflowRunId: string;
  mappings: FieldMapping[];
  missingFields: string[];
  ambiguousFields: string[];
  confidence: number;
  agentVersion: string;
  generatedAt?: string;
}

export interface ApprovalChallenge {
  approvalId: string;
  workflowRunId: string;
  action: 'submit_form';
  formId: string;
  formStateHash: string;
  actionHash: string;
  nonce: string;
  createdAt: string;
  expiresAt: string;
  status: 'pending' | 'consumed' | 'expired' | 'revoked';
}

export interface SessionRecord {
  sessionId: string;
  secretHash: string;
  createdAt: string;
  expiresAt: string;
  status: 'active' | 'revoked' | 'expired';
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
  | 'EvaAgent::"orchestrator"'
  | 'EvaAgent::"employment"'
  | 'EvaAgent::"government"'
  | 'EvaAgent::"healthcare"'
  | 'EvaAgent::"finance"'
  | 'EvaAgent::"education"'
  | 'EvaAgent::"legal"'
  | 'EvaAgent::"evidence"'
  | 'EvaAgent::"form_filling"'
  | 'EvaAgent::"form_execution"'
  | 'EvaAgent::"planner"'
  | 'EvaAgent::"search"'
  | 'EvaAgent::"document_evidence"'
  | 'EvaAgent::"compliance_auditor"'
  | `User::"${string}"`;

export type CedarAction =
  | 'Action::"read_document"'
  | 'Action::"use_sensitive_document"'
  | 'Action::"populate_form"'
  | 'Action::"submit_form"';

export type CedarResource =
  | 'Form::"internship_onboarding"'
  | 'Form::"hardware_procurement"'
  | 'Form::"medical_reimbursement"'
  | 'Form::"vendor_payout_update"'
  | `Form::"${string}"`
  | `Document::"${string}"`;

export interface CedarContext {
  conflict_resolved: boolean;
  evidence_confidence: number;
  human_approved: boolean;
  action_hash_valid?: boolean;
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
  sessionId?: string;
  previousEventHash?: string; // SHA-256 of preceding event (genesis = "GENESIS")
  eventHash?: string; // SHA-256(canonicalJson(event without eventHash))
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
  entryName?: string; // e.g. "entry.1849201"
  type?: 'text' | 'textarea' | 'radio' | 'checkbox' | 'dropdown' | 'other';
  options?: string[];
  required?: boolean;
}

export type OperationCategory =
  | 'onboarding'
  | 'procurement'
  | 'medical'
  | 'financial'
  | 'government'
  | 'education'
  | 'legal'
  | 'custom';

export interface WorkflowRun {
  workflowRunId: string;
  sessionId?: string;
  userId: string;
  intent: string;
  template: string;
  title?: string;
  category?: OperationCategory;
  targetSystem?: string;
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
  formPopulationPlan?: FormPopulationPlan;
  approvalChallenge?: ApprovalChallenge;
  latestExplanation?: DecisionExplanation;
  agentResponse?: string;
  externalReceiptHash?: string;
  parsedFormSchema?: ParsedFormSchema;
  suggestions?: { title: string; prompt: string; template?: string }[];
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

export interface VaultSearchResult {
  documentId: string;
  name: string;
  relevanceScore: number;
  s3Key: string;
  tags: string[];
  updatedAt: string;
  isFresh: boolean;
}

export interface SubmissionReceipt {
  receiptId: string;
  formId: string;
  targetEndpoint: string;
  submittedAt: string;
  statusCode: number;
  message: string;
  fieldsSubmitted: number;
}


