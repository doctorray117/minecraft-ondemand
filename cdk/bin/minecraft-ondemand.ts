#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { MinecraftStack } from '../lib/minecraft-ondemand-stack';
import { MinecraftLauncherStack } from '../lib/minecraft-launcher-stack';

const app = new cdk.App();

// Available server environment variables - https://github.com/itzg/docker-minecraft-server/blob/master/README.md#server-configuration
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
    startupMin: 10,
    serverEnvironment: {
        "MOTD": "Welcome to the server!",
        "MAX_PLAYERS": "10",
        "MODE": "CREATIVE"
    }
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