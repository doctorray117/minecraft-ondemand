#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { MinecraftStack } from '../lib/minecraft-ondemand-stack';
import { MinecraftLauncherStack } from '../lib/minecraft-launcher-stack';

const app = new cdk.App();

const account = "INSERT"
const region = "INSERT"

const minecraftStack = new MinecraftStack(app, 'MinecraftStack', {
    env: { account: account, region: region },
    clusterName: "minecraft",
    serviceName: "minecraft-server",
    vpcId: "INSERT",
    dnsZone: "INSERT",
    notificationEmail: "INSERT",
    serverName: "Minecraft Server",
    shutdownMin: 20,
    startupMin: 10
});

const minecraftLauncherStack = new MinecraftLauncherStack(app, 'MinecraftLauncherStack', {
    env: { account: account, region: "us-east-1" },
    clusterName: "minecraft",
    serviceName: "minecraft-server",
    regionName: region
});

minecraftLauncherStack.addDependency(minecraftStack, "The Minecraft launcher stack requires the ECS service ARNs to setup permissions to control the service.");