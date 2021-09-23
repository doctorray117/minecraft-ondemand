#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { MinecraftServerStack } from '../lib/minecraft-server-stack';
import { MinecraftLauncherStack } from '../lib/minecraft-launcher-stack';

const app = new cdk.App();

// Available server environment variables - https://github.com/itzg/docker-minecraft-server/blob/master/README.md#server-configuration
const configuration = {
    account: "INSERT",
    region: "INSERT",
    clusterName: "minecraft",
    serviceName: "minecraft-server",
    vpcId: "INSERT",
    domainName: "INSERT",
    domainHostedZoneId: "INSERT",
    domainQueryLogGroupName: "INSERT",
    shutdownMin: 20,
    startupMin: 10,
    serverEnvironment: {
        "MOTD": "Welcome to the server!",
        "MAX_PLAYERS": "10",
        "MODE": "CREATIVE"
    },
    fargateSpotPercentage: 100,
    enableFileSync: true
}

const minecraftStack = new MinecraftServerStack(app, 'MinecraftServerStack', {
    env: { account: configuration.account, region: configuration.region },
    ...configuration
});

const minecraftLauncherStack = new MinecraftLauncherStack(app, 'MinecraftLauncherStack', {
    env: { account: configuration.account, region: "us-east-1" },
    serverRegion: configuration.region,
    ...configuration
});

minecraftLauncherStack.addDependency(minecraftStack, "The Minecraft launcher stack requires the ECS service to be created.");