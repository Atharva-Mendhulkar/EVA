import * as fs from 'fs';
import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import { Construct } from 'constructs';

// EVA core data plane + API + orchestration (PRD Sections 12-14).
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

    // Shared Lambda task bundle from infra/lambda
    const lambdaCode = lambda.Code.fromAsset(path.join(__dirname, '..', 'lambda'));

    const commonEnv = {
      DDB_TABLE_NAME: table.tableName,
      S3_BUCKET_NAME: bucket.bucketName,
      AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1'
    };

    // Define Step Functions task Lambdas (PRD Sections 5, 8, 10, 14)
    const taskNames = [
      'eva-orchestrator',
      'eva-employment-agent',
      'eva-evidence-agent',
      'eva-conflict-detector',
      'eva-token-registrar',
      'eva-form-filling-agent',
      'eva-cedar-pdp',
      'eva-playwright-executor',
      'eva-audit-writer'
    ];

    const lambdaFunctions: Record<string, lambda.Function> = {};
    for (const name of taskNames) {
      const fn = new lambda.Function(this, `Fn-${name}`, {
        functionName: name,
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: 'index.handler',
        code: lambdaCode,
        timeout: cdk.Duration.seconds(30),
        memorySize: 512,
        environment: commonEnv
      });
      table.grantReadWriteData(fn);
      bucket.grantReadWrite(fn);
      kmsKey.grantEncryptDecrypt(fn);
      fn.addToRolePolicy(
        new iam.PolicyStatement({
          actions: ['bedrock:InvokeModel'],
          resources: ['*']
        })
      );
      lambdaFunctions[name] = fn;
    }

    // API Gateway HTTP API + Lambda Proxy
    const httpApi = new apigwv2.CfnApi(this, 'EvaHttpApi', {
      name: 'eva-backend-api',
      protocolType: 'HTTP',
      corsConfiguration: {
        allowOrigins: ['*'],
        allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
        allowHeaders: ['Content-Type', 'Authorization', 'X-EVA-Session-Id'],
        maxAge: 3600
      }
    });

    const apiIntegration = new apigwv2.CfnIntegration(this, 'EvaApiIntegration', {
      apiId: httpApi.ref,
      integrationType: 'AWS_PROXY',
      integrationUri: lambdaFunctions['eva-orchestrator'].functionArn,
      payloadFormatVersion: '2.0'
    });

    new apigwv2.CfnRoute(this, 'EvaDefaultRoute', {
      apiId: httpApi.ref,
      routeKey: '$default',
      target: `integrations/${apiIntegration.ref}`
    });

    new apigwv2.CfnStage(this, 'EvaDefaultStage', {
      apiId: httpApi.ref,
      stageName: '$default',
      autoDeploy: true
    });

    lambdaFunctions['eva-orchestrator'].addPermission('EvaHttpApiInvoke', {
      principal: new iam.ServicePrincipal('apigateway.amazonaws.com'),
      sourceArn: `arn:aws:execute-api:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:${httpApi.ref}/*/*`
    });

    // Step Functions Execution Role with Lambda invoke permissions
    const sfnRole = new iam.Role(this, 'EvaStepFunctionsRole', {
      assumedBy: new iam.ServicePrincipal('states.amazonaws.com')
    });
    sfnRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['lambda:InvokeFunction'],
        resources: Object.values(lambdaFunctions).map((f) => f.functionArn)
      })
    );

    // Step Functions Standard workflow (PRD Section 14)
    const definition = fs
      .readFileSync(path.join(__dirname, '..', '..', 'step-functions-workflow.json'), 'utf8')
      .replace(/123456789012/g, cdk.Aws.ACCOUNT_ID)
      .replace(/us-east-1/g, cdk.Aws.REGION);

    new sfn.CfnStateMachine(this, 'EvaOnboardingOrchestrator', {
      stateMachineName: 'eva-onboarding-orchestrator',
      stateMachineType: 'STANDARD',
      definitionString: definition,
      roleArn: sfnRole.roleArn
    });

    new cdk.CfnOutput(this, 'ApiGatewayUrl', {
      value: `https://${httpApi.ref}.execute-api.${cdk.Aws.REGION}.amazonaws.com`
    });
    new cdk.CfnOutput(this, 'TableName', { value: table.tableName });
    new cdk.CfnOutput(this, 'BucketName', { value: bucket.bucketName });
  }
}
