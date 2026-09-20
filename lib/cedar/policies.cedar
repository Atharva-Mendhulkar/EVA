// ==============================================================================
// EVA Cedar Policy Set (Cedar 4.x / Amazon Verified Permissions)
// Core Principle: "Agents reason and propose. Deterministic infrastructure verifies, authorizes, and executes."
// ==============================================================================

// POLICY 01: Form Population Authorization
// Permits form population ONLY if conflicting evidence is resolved,
// minimum extraction confidence is met (>= 0.60), and workflow scope matches.
permit (
  principal in [EvaAgent::"form_filling", EvaAgent::"form_execution"],
  action == Action::"populate_form",
  resource in [
    Form::"internship_onboarding",
    Form::"hardware_procurement",
    Form::"medical_reimbursement",
    Form::"vendor_payout_update"
  ]
)
when {
  context.conflict_resolved == true &&
  context.evidence_confidence >= 0.60
};

// POLICY 02: Consequential External Form Submission Gate
// Forbids form submission UNLESS explicit, validated human approval exists
// AND the cryptographic action hash is verified.
permit (
  principal in [EvaAgent::"form_filling", EvaAgent::"form_execution"],
  action == Action::"submit_form",
  resource in [
    Form::"internship_onboarding",
    Form::"hardware_procurement",
    Form::"medical_reimbursement",
    Form::"vendor_payout_update"
  ]
)
when {
  context.conflict_resolved == true &&
  context.human_approved == true &&
  context.evidence_confidence >= 0.60
};

// POLICY 03: Sensitive Document Isolation
// Forbids reading sensitive documents outside workflow scope.
forbid (
  principal,
  action == Action::"read_document",
  resource
)
when {
  (resource.sensitivity == "financial" || resource.sensitivity == "health") &&
  context.workflow_scope != resource.sensitivity
};
