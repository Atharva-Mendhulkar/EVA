import { describe, it, expect, beforeEach } from 'vitest';
import { WorkflowStore } from '../lib/engine/state-machine';
import { extractUrls, isGoogleFormUrl, parseGoogleFormHtml } from '../lib/engine/form-parser';
import { matchFormQuestionsToVault } from '../lib/engine/dynamic-matcher';
import { FormQuestion } from '../lib/engine/types';

describe('Dynamic Form Capabilities & Live Google Forms Engine', () => {
  let store: WorkflowStore;

  beforeEach(() => {
    store = new WorkflowStore();
  });

  // 1. Clean boot: zero pre-seeded workflows
  it('1. WorkflowStore boots clean with zero hardcoded workflows', () => {
    const list = store.listWorkflows();
    expect(list.length).toBe(0);
    expect(store.getActiveWorkflow()).toBeNull();
  });

  // 2. URL Extraction and Detection
  it('2. Extracts and detects Google Form URLs accurately', () => {
    const prompt1 = 'Please fill out this form https://docs.google.com/forms/d/e/1FAIpQLScX9_SampleForm/viewform for me';
    const urls1 = extractUrls(prompt1);
    expect(urls1).toHaveLength(1);
    expect(urls1[0]).toBe('https://docs.google.com/forms/d/e/1FAIpQLScX9_SampleForm/viewform');
    expect(isGoogleFormUrl(urls1[0])).toBe(true);

    const prompt2 = 'Check out https://forms.gle/xYz12345ABC and complete the registration';
    const urls2 = extractUrls(prompt2);
    expect(urls2).toHaveLength(1);
    expect(urls2[0]).toBe('https://forms.gle/xYz12345ABC');
    expect(isGoogleFormUrl(urls2[0])).toBe(true);

    const prompt3 = 'Research at https://example.com/portal';
    const urls3 = extractUrls(prompt3);
    expect(urls3).toHaveLength(1);
    expect(isGoogleFormUrl(urls3[0])).toBe(false);
  });

  // 3. FB_PUBLIC_LOAD_DATA_ parsing from Google Form HTML
  it('3. Parses Google Form HTML and extracts FB_PUBLIC_LOAD_DATA_ payload', () => {
    const mockHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta property="og:title" content="Engineering Fellow Application 2026">
          <meta property="og:description" content="Official candidate application form">
        </head>
        <body>
          <script type="text/javascript">
            var FB_PUBLIC_LOAD_DATA_ = [
              null,
              [
                null,
                [
                  [101, "Full Legal Name", "As written on government ID", 0, [[1849201, null, 1]]],
                  [102, "University / College", "Degree granting institution", 0, [[1849202, null, 1]]],
                  [103, "Role / Position", "Preferred engineering discipline", 2, [[1849203, [["Autonomous Systems Engineering Intern"], ["AI Research Fellow"]], 0]]],
                  [104, "Designated Work Location", "Primary work city", 0, [[1849204, null, 1]]],
                  [105, "GitHub Profile Link", "Link to open source repositories", 0, [[1849205, null, 0]]],
                  [106, "Brief Statement of Experience", "Tell us about your background", 1, [[1849206, null, 0]]]
                ]
              ]
            ];
          </script>
        </body>
      </html>
    `;

    const rawUrl = 'https://docs.google.com/forms/d/e/1FAIpQLScX9_SampleForm/viewform';
    const schema = parseGoogleFormHtml(mockHtml, rawUrl);

    expect(schema.isGoogleForm).toBe(true);
    expect(schema.title).toBe('Engineering Fellow Application 2026');
    expect(schema.actionUrl).toContain('/formResponse');
    expect(schema.questions).toHaveLength(6);

    // Verify first question: Full Legal Name
    expect(schema.questions[0].title).toBe('Full Legal Name');
    expect(schema.questions[0].entryName).toBe('entry.1849201');
    expect(schema.questions[0].type).toBe('text');
    expect(schema.questions[0].required).toBe(true);

    // Verify radio question: Role
    expect(schema.questions[2].title).toBe('Role / Position');
    expect(schema.questions[2].entryName).toBe('entry.1849203');
    expect(schema.questions[2].type).toBe('radio');
    expect(schema.questions[2].options).toContain('Autonomous Systems Engineering Intern');

    // Verify textarea question: Experience Statement
    expect(schema.questions[5].title).toBe('Brief Statement of Experience');
    expect(schema.questions[5].entryName).toBe('entry.1849206');
    expect(schema.questions[5].type).toBe('textarea');
  });

  // 4. Semantic Evidence Matcher
  it('4. Matches arbitrary form questions to Personal Vault facts', () => {
    const questions: FormQuestion[] = [
      { id: 'q1', title: 'Applicant Full Name', type: 'text', entryName: 'entry.101', required: true },
      { id: 'q2', title: 'Degree Granting University', type: 'text', entryName: 'entry.102', required: true },
      { id: 'q3', title: 'Company / Organization', type: 'text', entryName: 'entry.103', required: false },
      { id: 'q4', title: 'GitHub Portfolio URL', type: 'text', entryName: 'entry.104', required: false },
      { id: 'q5', title: 'Primary Work Location', type: 'text', entryName: 'entry.105', required: true },
    ];

    const matchResult = matchFormQuestionsToVault(questions, 'test_run_dyn');

    expect(matchResult.evidence.length).toBeGreaterThanOrEqual(4);

    const nameEv = matchResult.evidence.find((e) => e.field === 'entry.101');
    expect(nameEv).toBeDefined();
    expect(nameEv?.value).toBe('Atharva Mendhulkar');
    expect(nameEv?.sourceDocumentName).toBe('Personal_Profile.pdf');

    const uniEv = matchResult.evidence.find((e) => e.field === 'entry.102');
    expect(uniEv).toBeDefined();
    expect(uniEv?.value).toBe('Indian Institute of Technology, Bombay');

    const gitEv = matchResult.evidence.find((e) => e.field === 'entry.104');
    expect(gitEv).toBeDefined();
    expect(gitEv?.value).toBe('https://github.com/Atharva-Mendhulkar');

    // Location contradiction should be caught and flagged as conflict
    expect(matchResult.conflicts).toHaveLength(1);
    expect(matchResult.conflicts[0].field).toBe('entry.105');
    expect(matchResult.conflicts[0].candidateEvidence).toHaveLength(2);
  });

  // 5. Dynamic Google Form Workflow Creation from prompt link
  it('5. Creates dynamic workflow when user sends a Google Form link', () => {
    const userPrompt = 'Here is the form: https://docs.google.com/forms/d/e/1FAIpQLScX9_SampleForm/viewform please fill it on my behalf';
    const wf = store.createWorkflow(userPrompt);

    expect(wf.workflowRunId).toBeDefined();
    expect(wf.parsedFormSchema).toBeDefined();
    expect(wf.parsedFormSchema?.isGoogleForm).toBe(true);
    expect(wf.formFields.length).toBeGreaterThan(0);

    // Verify formFields contain dynamic entry names
    const hasEntryFields = wf.formFields.some((f) => f.entryName?.startsWith('entry.'));
    expect(hasEntryFields).toBe(true);

    // Has Cedar approval challenge
    expect(wf.approvalChallenge).toBeDefined();
    expect(wf.approvalChallenge?.status).toBe('pending');
  });

  // 6. Approval and submission of dynamic form
  it('6. Approves and executes dynamic Google Form submission', () => {
    const userPrompt = 'https://docs.google.com/forms/d/e/1FAIpQLScX9_SampleForm/viewform fill form';
    const wf = store.createWorkflow(userPrompt);

    // If there is a location conflict, resolve it first
    let currentWf = wf;
    if (currentWf.status === 'AWAITING_USER_RESOLUTION' && currentWf.conflicts.length > 0) {
      const conf = currentWf.conflicts[0];
      currentWf = store.resolveConflict(
        currentWf.workflowRunId,
        conf.conflictId,
        conf.candidateEvidence[0].evidenceId
      );
    }

    expect(currentWf.status).toBe('AWAITING_HUMAN_APPROVAL');
    expect(currentWf.approvalChallenge?.nonce).toBeDefined();

    const approvedWf = store.approveSubmission(
      currentWf.workflowRunId,
      'APPROVE',
      'Verified all dynamic form entries',
      currentWf.approvalChallenge!.nonce
    );

    expect(approvedWf.status).toBe('COMPLETED');
    const completionAudit = approvedWf.auditTrail.find((a) => a.action === 'sandbox_submission');
    expect(completionAudit).toBeDefined();
    expect(completionAudit?.decision).toBe('SUCCESS');
    expect(completionAudit?.reason).toContain('Google Forms');
  });
});
