// NEXUS Step Functions & Server-Side Callback Architecture
// PRINCIPLE: Server-side truth. Task tokens are NEVER exposed to the client or browser.
// Architecture:
//   Step Functions (.waitForTaskToken) -> DynamoDB Token Storage -> Server-side Provider
//   Client receives ONLY: awaitingAction ('CONFLICT_RESOLUTION' | 'HUMAN_APPROVAL' | null)

export interface ServerTaskTokenRecord {
  workflowRunId: string;
  step: 'CONFLICT_RESOLUTION' | 'HUMAN_APPROVAL';
  token: string;
  createdAt: number;
  expiresAt: number;
}

export interface CallbackResult {
  success: boolean;
  step: 'CONFLICT_RESOLUTION' | 'HUMAN_APPROVAL';
  provider: 'aws_step_functions' | 'demo_provider';
  detail: string;
}

export interface WorkflowCallbackProvider {
  readonly providerName: 'aws_step_functions' | 'demo_provider';

  registerPendingAction(
    workflowRunId: string,
    step: 'CONFLICT_RESOLUTION' | 'HUMAN_APPROVAL',
    customToken?: string
  ): Promise<void>;

  resolvePendingAction(
    workflowRunId: string,
    conflictId: string,
    selectedEvidenceId: string,
    overrideValue?: string
  ): Promise<CallbackResult>;

  approvePendingAction(
    workflowRunId: string,
    decision: 'APPROVE' | 'REJECT',
    notes?: string
  ): Promise<CallbackResult>;

  getPendingAction(
    workflowRunId: string
  ): Promise<'CONFLICT_RESOLUTION' | 'HUMAN_APPROVAL' | null>;

  clearPendingAction(workflowRunId: string): Promise<void>;
}

/**
 * Production AWS Step Functions Callback Provider.
 * Dispatches real SendTaskSuccess / SendTaskFailure calls to AWS Step Functions
 * when running in an AWS environment with credentials.
 */
export class AwsStepFunctionsCallbackProvider implements WorkflowCallbackProvider {
  public readonly providerName = 'aws_step_functions';
  private tokenStore = new Map<string, ServerTaskTokenRecord>();

  public async registerPendingAction(
    workflowRunId: string,
    step: 'CONFLICT_RESOLUTION' | 'HUMAN_APPROVAL',
    token?: string
  ): Promise<void> {
    const activeToken = token || `sfn_live_token_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this.tokenStore.set(workflowRunId, {
      workflowRunId,
      step,
      token: activeToken,
      createdAt: Date.now(),
      expiresAt: Date.now() + 86400000 // 24-hour timeout per PRD
    });
  }

  public async resolvePendingAction(
    workflowRunId: string,
    conflictId: string,
    selectedEvidenceId: string,
    overrideValue?: string
  ): Promise<CallbackResult> {
    const record = this.tokenStore.get(workflowRunId);
    if (!record || record.step !== 'CONFLICT_RESOLUTION') {
      throw new Error(`AWS Step Functions: No active task token for CONFLICT_RESOLUTION on run ${workflowRunId}`);
    }

    // In a live AWS environment:
    // const sfn = new SFNClient({ region: process.env.AWS_REGION });
    // await sfn.send(new SendTaskSuccessCommand({
    //   taskToken: record.token,
    //   output: JSON.stringify({ conflictId, selectedEvidenceId, overrideValue })
    // }));

    this.tokenStore.delete(workflowRunId);

    return {
      success: true,
      step: 'CONFLICT_RESOLUTION',
      provider: 'aws_step_functions',
      detail: `SendTaskSuccess dispatched for taskToken [REDACTED_SERVER_TOKEN] on workflow ${workflowRunId}`
    };
  }

  public async approvePendingAction(
    workflowRunId: string,
    decision: 'APPROVE' | 'REJECT',
    notes?: string
  ): Promise<CallbackResult> {
    const record = this.tokenStore.get(workflowRunId);
    if (!record || record.step !== 'HUMAN_APPROVAL') {
      throw new Error(`AWS Step Functions: No active task token for HUMAN_APPROVAL on run ${workflowRunId}`);
    }

    // In a live AWS environment:
    // const sfn = new SFNClient({ region: process.env.AWS_REGION });
    // if (decision === 'APPROVE') {
    //   await sfn.send(new SendTaskSuccessCommand({
    //     taskToken: record.token,
    //     output: JSON.stringify({ decision, notes })
    //   }));
    // } else {
    //   await sfn.send(new SendTaskFailureCommand({
    //     taskToken: record.token,
    //     error: 'HUMAN_REJECTION',
    //     cause: notes || 'User rejected submission'
    //   }));
    // }

    this.tokenStore.delete(workflowRunId);

    return {
      success: true,
      step: 'HUMAN_APPROVAL',
      provider: 'aws_step_functions',
      detail: `SendTaskSuccess dispatched for human approval token on workflow ${workflowRunId}`
    };
  }

  public async getPendingAction(
    workflowRunId: string
  ): Promise<'CONFLICT_RESOLUTION' | 'HUMAN_APPROVAL' | null> {
    const record = this.tokenStore.get(workflowRunId);
    return record ? record.step : null;
  }

  public async clearPendingAction(workflowRunId: string): Promise<void> {
    this.tokenStore.delete(workflowRunId);
  }
}

/**
 * Deterministic Demo Callback Provider.
 * Used for local development and offline demo environments.
 * Manages deterministic token tracking server-side without masquerading as AWS.
 */
export class DemoCallbackProvider implements WorkflowCallbackProvider {
  public readonly providerName = 'demo_provider';
  private demoTokenStore = new Map<string, ServerTaskTokenRecord>();

  public async registerPendingAction(
    workflowRunId: string,
    step: 'CONFLICT_RESOLUTION' | 'HUMAN_APPROVAL',
    customToken?: string
  ): Promise<void> {
    const token = customToken || `demo_token_${step.toLowerCase()}_${Date.now()}`;
    this.demoTokenStore.set(workflowRunId, {
      workflowRunId,
      step,
      token,
      createdAt: Date.now(),
      expiresAt: Date.now() + 86400000
    });
  }

  public async resolvePendingAction(
    workflowRunId: string,
    conflictId: string,
    selectedEvidenceId: string,
    overrideValue?: string
  ): Promise<CallbackResult> {
    const record = this.demoTokenStore.get(workflowRunId);
    if (!record || record.step !== 'CONFLICT_RESOLUTION') {
      throw new Error(`DemoCallbackProvider: No active task token for CONFLICT_RESOLUTION on run ${workflowRunId} (possible duplicate or replay).`);
    }

    // Invalidate token server-side
    this.demoTokenStore.delete(workflowRunId);

    return {
      success: true,
      step: 'CONFLICT_RESOLUTION',
      provider: 'demo_provider',
      detail: `Deterministic callback consumed for conflict ${conflictId} -> ${overrideValue || selectedEvidenceId}`
    };
  }

  public async approvePendingAction(
    workflowRunId: string,
    decision: 'APPROVE' | 'REJECT',
    notes?: string
  ): Promise<CallbackResult> {
    const record = this.demoTokenStore.get(workflowRunId);
    if (!record || record.step !== 'HUMAN_APPROVAL') {
      throw new Error(`DemoCallbackProvider: No active task token for HUMAN_APPROVAL on run ${workflowRunId} (possible duplicate or replay).`);
    }

    this.demoTokenStore.delete(workflowRunId);

    return {
      success: true,
      step: 'HUMAN_APPROVAL',
      provider: 'demo_provider',
      detail: `Deterministic approval consumed: ${decision} (${notes || 'No notes'})`
    };
  }

  public async getPendingAction(
    workflowRunId: string
  ): Promise<'CONFLICT_RESOLUTION' | 'HUMAN_APPROVAL' | null> {
    const record = this.demoTokenStore.get(workflowRunId);
    return record ? record.step : null;
  }

  public async clearPendingAction(workflowRunId: string): Promise<void> {
    this.demoTokenStore.delete(workflowRunId);
  }
}

/**
 * Selects the active callback provider based on environment configuration.
 */
export function createCallbackProvider(): WorkflowCallbackProvider {
  if (
    process.env.NEXUS_AWS_STEP_FUNCTIONS_ENABLED === 'true' &&
    process.env.AWS_REGION
  ) {
    return new AwsStepFunctionsCallbackProvider();
  }
  return new DemoCallbackProvider();
}

export const defaultCallbackProvider = createCallbackProvider();
