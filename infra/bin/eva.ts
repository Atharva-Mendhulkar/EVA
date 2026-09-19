#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { EvaCoreStack } from '../lib/eva-stack';

const app = new cdk.App();
new EvaCoreStack(app, 'EvaCoreStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1'
  }
});
