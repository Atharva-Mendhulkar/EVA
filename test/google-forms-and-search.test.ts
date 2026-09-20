import { describe, it, expect } from 'vitest';
import { WorkflowStore, classifyIntent } from '../lib/engine/state-machine';
import { searchInternet } from '../lib/engine/search';
import { cedarEngine } from '../lib/cedar/engine';

describe('Google Forms Automation & Web Research Agents', () => {
  it('classifies Google Forms intent correctly from URL or natural language', () => {
    expect(classifyIntent('https://docs.google.com/forms/d/e/1FAIpQLSc.../viewform')).toBe('google_forms_fill');
    expect(classifyIntent('fill google form for candidate registration')).toBe('google_forms_fill');
    expect(classifyIntent('fill out the onboarding form on google forms')).toBe('google_forms_fill');
    expect(classifyIntent('forms.gle/xyz123')).toBe('google_forms_fill');
  });

  it('classifies Web Search intent correctly', () => {
    expect(classifyIntent('search internet for WeMakeDevs hackathon guidelines')).toBe('web_search_research');
    expect(classifyIntent('search the web for AWS Bedrock documentation')).toBe('web_search_research');
    expect(classifyIntent('look up online recent AI compliance laws')).toBe('web_search_research');
  });

  it('initializes Google Forms workflow with populated fields, zero loops, and halts at human approval', () => {
    const store = new WorkflowStore();
    const wf = store.createWorkflow('fill google form for software engineering internship');

    expect(wf.template).toBe('google_forms_fill');
    expect(wf.status).toBe('AWAITING_HUMAN_APPROVAL');
    expect(wf.awaitingAction).toBe('HUMAN_APPROVAL');
    expect(wf.stepIndex).toBe(7);
    expect(wf.formFields.length).toBe(5);

    // Verify fields are populated from vault documents
    const nameField = wf.formFields.find((f) => f.canonicalField === 'full_name');
    expect(nameField).toBeDefined();
    expect(nameField?.value).toBe('Atharva Mendhulkar');
    expect(nameField?.sourceDocument).toBe('Personal_Profile.pdf');

    const roleField = wf.formFields.find((f) => f.canonicalField === 'role');
    expect(roleField).toBeDefined();
    expect(roleField?.value).toBe('Software Engineering Intern');

    // Verify cryptographic single-use approval challenge was created
    expect(wf.approvalChallenge).toBeDefined();
    expect(wf.approvalChallenge?.status).toBe('pending');
    expect(wf.approvalChallenge?.nonce).toHaveLength(32);

    // Verify Cedar Policy evaluated DENY for submit before human approval
    const preSubmit = wf.cedarDecisions.find((d) => d.action === 'Action::"submit_form"');
    expect(preSubmit).toBeDefined();
    expect(preSubmit?.decision).toBe('DENY');
  });

  it('approves Google Form submission successfully and writes cryptographic receipt to audit trail', () => {
    const store = new WorkflowStore();
    const wf = store.createWorkflow('fill google form for candidate registration');

    expect(wf.status).toBe('AWAITING_HUMAN_APPROVAL');
    const challengeNonce = wf.approvalChallenge?.nonce;

    const approvedWf = store.approveSubmission(wf.workflowRunId, 'APPROVE', 'Verified form', challengeNonce);
    expect(approvedWf.status).toBe('COMPLETED');
    expect(approvedWf.awaitingAction).toBeNull();
    expect(approvedWf.stepIndex).toBe(8);

    // Verify audit event has submission receipt
    const successEvent = approvedWf.auditTrail.find((e) => e.decision === 'SUCCESS');
    expect(successEvent).toBeDefined();
    expect(successEvent?.action).toContain('submission');
  });

  it('searches the internet and synthesizes results with sources and citations', async () => {
    const res = await searchInternet('AWS Bedrock foundation models');
    expect(res.query).toBe('AWS Bedrock foundation models');
    expect(res.summary).toBeDefined();
    expect(res.results.length).toBeGreaterThan(0);
    expect(res.results[0].title).toBeDefined();
    expect(res.results[0].url).toBeDefined();
    expect(res.results[0].sourceDomain).toBeDefined();
  });

  it('routes "find me the best ai intern jobs in blr" to web search without fake demo conflict', () => {
    const prompt = 'find me the best ai intern jobs in blr';
    expect(classifyIntent(prompt)).toBe('web_search_research');

    const store = new WorkflowStore();
    const wf = store.createWorkflow(prompt);

    expect(wf.template).toBe('web_search_research');
    expect(wf.status).toBe('COMPLETED');
    expect(wf.stepIndex).toBe(8);
    expect(wf.currentStep).toBe('Completed · HTTP 200 OK');
    expect(wf.conflicts).toHaveLength(0);
    expect(wf.awaitingAction).toBeNull();
    expect(wf.plan).toHaveLength(8);
    expect(wf.plan.every((s) => s.status === 'COMPLETED')).toBe(true);

    // Verify Cedar authorization is present for read operation
    const cedarRead = wf.cedarDecisions.find((d) => d.action === 'Action::"read_document"');
    expect(cedarRead).toBeDefined();
    expect(cedarRead?.decision).toBe('ALLOW');
  });

  it('synthesizes top AI internship intelligence for Bangalore queries', async () => {
    const res = await searchInternet('find me the best ai intern jobs in blr');
    expect(res.summary).toContain('Top AI & Machine Learning Internship Opportunities in Bangalore');
    expect(res.summary).toContain('Microsoft Research India');
    expect(res.summary).toContain('Google DeepMind');
    expect(res.results.length).toBeGreaterThan(0);
    expect(res.results.some((r) => r.sourceDomain.includes('careers.microsoft.com') || r.sourceDomain.includes('google.com'))).toBe(true);
  });
});
