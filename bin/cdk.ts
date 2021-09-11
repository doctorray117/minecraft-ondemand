#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { MinecraftStack } from '../lib/minecraft-stack';
import { DomainStack } from '../lib/domain-stack';
import { constants } from '../lib/constants';
import { config } from '../lib/config';

const app = new cdk.App();

const domainStack = new DomainStack(app, 'minecraft-domain-stack', {
  env: {
    /**
     * Because we are relying on Route 53+CloudWatch to invoke the Lambda function,
     * it _must_ reside in the N. Virginia (us-east-1) region.
     */
    region: constants.DOMAIN_STACK_REGION,
  }
});

const minecraftStack = new MinecraftStack(app, 'minecraft-server-stack', {
  env: {
    region: config.SERVER_REGION
  },
});

minecraftStack.addDependency(domainStack);
