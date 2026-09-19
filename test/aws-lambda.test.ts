import { describe, it, expect } from 'vitest';
// @ts-ignore - CommonJS AWS Lambda handler
const lambda = require('../infra/lambda/index.js');

describe('EVA AWS Lambda & Serverless Step Functions Tasks (PRD Sections 5, 8, 10, 14)', () => {
  it('handles API Gateway HTTP requests as health proxy', async () => {
    const event = {
      requestContext: { http: { method: 'GET', path: '/' } },
      rawPath: '/'
    };
    const res = await lambda.handler(event, {});
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('healthy');
    expect(body.service).toBe('eva-core-backend');
    expect(body.path).toBe('/');
  });

  it('executes eva-orchestrator task and emits template classification', async () => {
    const event = { intent: "I'm starting an internship in Bangalore" };
    const res = await lambda.handler(event, { functionName: 'eva-orchestrator' });
    expect(res.template).toBe('internship_onboarding');
    expect(res.planConfidence).toBe(0.98);
    expect(res.workflowRunId).toBeDefined();
  });

  it('executes eva-employment-agent task and returns checklist + required fields', async () => {
    const res = await lambda.handler({}, { functionName: 'eva-employment-agent' });
    expect(res.requiredFields).toContain('work_location');
    expect(res.requiredFields).toContain('bank_account_number');
    expect(res.documentChecklist).toContain('Internship_Offer_Letter.pdf');
  });

  it('executes eva-evidence-agent task and returns grounded evidence', async () => {
    const res = await lambda.handler({}, { functionName: 'eva-evidence-agent' });
    expect(res.evidence.length).toBeGreaterThanOrEqual(2);
    const locations = res.evidence.filter((e: any) => e.field === 'work_location');
    expect(locations).toHaveLength(2);
  });

  it('executes eva-conflict-detector task and flags critical conflict', async () => {
    const res = await lambda.handler({}, { functionName: 'eva-conflict-detector' });
    expect(res.hasCriticalConflict).toBe(true);
    expect(res.conflicts[0].field).toBe('work_location');
  });

  it('executes eva-token-registrar for Step Functions task token resume', async () => {
    const event = { step: 'AWAIT_CONFLICT_RESOLUTION', workflowRunId: 'run_aws_123' };
    const res = await lambda.handler(event, { functionName: 'eva-token-registrar' });
    expect(res.registered).toBe(true);
    expect(res.step).toBe('AWAIT_CONFLICT_RESOLUTION');
    expect(res.workflowRunId).toBe('run_aws_123');
  });

  it('executes eva-form-filling-agent to generate FormPopulationPlan', async () => {
    const res = await lambda.handler({ workflowRunId: 'run_aws_123' }, { functionName: 'eva-form-filling-agent' });
    expect(res.formPopulationPlan).toBeDefined();
    expect(res.formPopulationPlan.formId).toBe('internship_onboarding');
    expect(res.formPopulationPlan.mappings.length).toBeGreaterThan(0);
  });

  it('executes eva-cedar-pdp enforcing Policy 01 (populate) and Policy 02 (submit)', async () => {
    // Populate form: DENY when conflict not resolved
    const popDeny = await lambda.handler(
      { action: 'Action::"populate_form"', context: { conflict_resolved: false, evidence_confidence: 0.98 } },
      { functionName: 'eva-cedar-pdp' }
    );
    expect(popDeny.decision).toBe('DENY');

    // Populate form: ALLOW when conflict resolved and confidence >= 0.60
    const popAllow = await lambda.handler(
      { action: 'Action::"populate_form"', context: { conflict_resolved: true, evidence_confidence: 0.98 } },
      { functionName: 'eva-cedar-pdp' }
    );
    expect(popAllow.decision).toBe('ALLOW');

    // Submit form: DENY without human approval
    const subDeny = await lambda.handler(
      { action: 'Action::"submit_form"', context: { human_approved: false } },
      { functionName: 'eva-cedar-pdp' }
    );
    expect(subDeny.decision).toBe('DENY');

    // Submit form: ALLOW with human approval
    const subAllow = await lambda.handler(
      { action: 'Action::"submit_form"', context: { human_approved: true } },
      { functionName: 'eva-cedar-pdp' }
    );
    expect(subAllow.decision).toBe('ALLOW');
  });

  it('executes eva-playwright-executor for POPULATE and SUBMIT', async () => {
    // Populate
    const popRes = await lambda.handler(
      { action: 'POPULATE', workflowRunId: 'run_aws_123' },
      { functionName: 'eva-playwright-executor' }
    );
    expect(popRes.status).toBe('POPULATED');
    expect(popRes.fieldsPopulated).toBe(6);
    expect(popRes.formStateHash).toBeDefined();

    // Submit
    const subRes = await lambda.handler(
      { action: 'SUBMIT', workflowRunId: 'run_aws_123' },
      { functionName: 'eva-playwright-executor' }
    );
    expect(subRes.statusCode).toBe(200);
    expect(subRes.status).toBe('SUBMITTED');
    expect(subRes.receiptId).toMatch(/^rcpt_/);
  });

  it('executes eva-audit-writer and verifies chain continuity', async () => {
    const res = await lambda.handler({}, { functionName: 'eva-audit-writer' });
    expect(res.auditVerified).toBe(true);
    expect(res.chainContinuity).toBe('PASS');
    expect(res.completedAt).toBeDefined();
  });
});
