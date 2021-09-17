#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { MinecraftStack } from '../lib/minecraft-ondemand-stack';
import { MinecraftLauncherStack } from '../lib/minecraft-launcher-stack';

const app = new cdk.App();

const account = "INSERT"
const region = "INSERT"

new MinecraftStack(app, 'MinecraftStack', {
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

new MinecraftLauncherStack(app, 'MinecraftLauncherStack', {
    env: { account: account, region: "us-east-1" },
    clusterName: "minecraft",
    serviceName: "minecraft-server",
    regionName: region
});
