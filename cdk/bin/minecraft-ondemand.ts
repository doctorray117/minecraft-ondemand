#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { MinecraftStack } from '../lib/minecraft-ondemand-stack';
import { MinecraftLauncherStack } from '../lib/minecraft-launcher-stack';

const app = new cdk.App();

const configuration = {
    account: "INSERT",
    region: "INSERT",
    clusterName: "minecraft",
    serviceName: "minecraft-server",
    vpcId: "INSERT",
    hostedZoneId: "INSERT",
    notificationEmail: "INSERT",
    domainName: "INSERT",
    shutdownMin: 20,
    startupMin: 10
}

const minecraftStack = new MinecraftStack(app, 'MinecraftStack', {
    env: { account: configuration.account, region: configuration.region },
    ...configuration
});

const minecraftLauncherStack = new MinecraftLauncherStack(app, 'MinecraftLauncherStack', {
    env: { account: configuration.account, region: "us-east-1" },
    serverRegion: configuration.region,
    ...configuration
});

minecraftLauncherStack.addDependency(minecraftStack, "The Minecraft launcher stack requires the ECS service ARNs to setup permissions to control the service.");