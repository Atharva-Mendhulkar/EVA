import * as fs from 'fs';
import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import { Construct } from 'constructs';

// EVA core data plane + API + orchestration (PRD Sections 12-14).
// Session/atom mapping follows the single-table model: PK SESSION#<id>.
export class EvaCoreStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const kmsKey = new kms.Key(this, 'EvaKmsKey', {
      description: 'EVA Customer Managed Key for S3 & DynamoDB SSE-KMS',
      enableKeyRotation: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });

    const table = new dynamodb.Table(this, 'EvaTable', {
      tableName: 'eva-core',
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      timeToLiveAttribute: 'expiresAt',
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: kmsKey,
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });

    const bucket = new s3.Bucket(this, 'EvaDocumentBucket', {
      bucketName: `eva-session-docs-${cdk.Aws.ACCOUNT_ID}`,
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: kmsKey,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      lifecycleRules: [{ id: 'SessionDocTtlCleanup', expiration: cdk.Duration.days(1) }],
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true
    });

    const httpApi = new apigwv2.CfnApi(this, 'EvaHttpApi', {
      name: 'eva-backend-api',
      protocolType: 'HTTP',
      corsConfiguration: {
        allowOrigins: ['http://localhost:3000', 'https://eva-*.vercel.app'],
        allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
        allowHeaders: ['Content-Type', 'Authorization', 'X-EVA-Session-Id'],
        maxAge: 3600
      }
    });

    // Step Functions Standard workflow (PRD Section 14). The checked-in
    // definition carries placeholder ARNs; synth substitutes this account.
    const definition = fs
      .readFileSync(path.join(__dirname, '..', '..', 'step-functions-workflow.json'), 'utf8')
      .replace(/123456789012/g, cdk.Aws.ACCOUNT_ID)
      .replace(/nexus-/g, 'eva-');
    new sfn.CfnStateMachine(this, 'EvaOnboardingOrchestrator', {
      stateMachineName: 'eva-onboarding-orchestrator',
      stateMachineType: 'STANDARD',
      definitionString: definition,
      roleArn: `arn:aws:iam::${cdk.Aws.ACCOUNT_ID}:role/eva-step-functions-role`
    });

    new cdk.CfnOutput(this, 'ApiGatewayUrl', { value: `https://${httpApi.ref}.execute-api.${cdk.Aws.REGION}.amazonaws.com` });
    new cdk.CfnOutput(this, 'TableName', { value: table.tableName });
    new cdk.CfnOutput(this, 'BucketName', { value: bucket.bucketName });
  }
}
