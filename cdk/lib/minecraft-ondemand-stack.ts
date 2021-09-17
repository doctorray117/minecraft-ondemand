import * as cdk from '@aws-cdk/core';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as efs from '@aws-cdk/aws-efs';
import * as ecs from '@aws-cdk/aws-ecs';
import * as sns from '@aws-cdk/aws-sns';
import * as iam from '@aws-cdk/aws-iam';
import { NetworkLoadBalancedFargateService } from '@aws-cdk/aws-ecs-patterns';

export interface MinecraftStackProps extends cdk.StackProps
{
    vpcId: string;
    dnsZone: string;
    serverName: string;
    startupMin: number;
    shutdownMin: number;
    notificationEmail: string;
}

interface FileSystemDetails
{
    fileSystemId: string;
    accessPointId: string;
}

export class MinecraftStack extends cdk.Stack
{
    constructor(scope: cdk.Construct, id: string, props: MinecraftStackProps)
    {
        super(scope, id, props);

        const vpc = ec2.Vpc.fromLookup(this, "MinecraftVpc", { vpcId: props.vpcId });

        const fileSystemDetails = this.createFileSystem(vpc);

        const snsTopicArn = this.createSnsTopic(props);

        this.createEcs(props, vpc, fileSystemDetails, snsTopicArn);
    }

    private createFileSystem(vpc: ec2.IVpc): FileSystemDetails
    {
        const fileSystem = new efs.FileSystem(this, 'MinecraftFileSystem', {
            vpc: vpc
        });

        const accessPoint = fileSystem.addAccessPoint("MinecraftAccessPoint", {
            path: "/minecraft",
            posixUser: {
                uid: "1000",
                gid: "1000"
            },
            createAcl: {
                ownerUid: "1000",
                ownerGid: "1000",
                permissions: "0755"
            }
        });

        return {
            fileSystemId: fileSystem.fileSystemId,
            accessPointId: accessPoint.accessPointId
        };
    }

    private createSnsTopic(props: MinecraftStackProps): string
    {
        const topic = new sns.Topic(this, "MinecraftTopic", {
            topicName: "minecraft-notifications",
            displayName: "Minecraft Notifications"
        });

        new sns.Subscription(this, "MinecraftEmailSubscription", {
            topic: topic,
            protocol: sns.SubscriptionProtocol.EMAIL,
            endpoint: props.notificationEmail,
        });

        return topic.topicArn;
    }

    private createEcs(props: MinecraftStackProps, vpc: ec2.IVpc, fileSystemDetails: FileSystemDetails, snsTopicArn: string)
    {
        const serviceName = "minecraft-server";

        var service = new NetworkLoadBalancedFargateService(this, "MinecraftService", {
            serviceName: serviceName,
            vpc: vpc,
            platformVersion: ecs.FargatePlatformVersion.VERSION1_4,
            assignPublicIp: true,
            taskImageOptions: {
                containerName: "minecraft-ecsfargate-watchdog",
                image: ecs.ContainerImage.fromRegistry("doctorray/minecraft-ecsfargate-watchdog"),
                environment: {
                    "CLUSTER": "minecraft",
                    "SERVICE": serviceName,
                    "DNSZONE": props.dnsZone,
                    "SERVERNAME": props.serverName,
                    "SNSTOPIC": snsTopicArn,
                    // "TWILIOFROM": "TODO",
                    // "TWILIOTO": "TODO",
                    // "TWILIOAID": "TODO",
                    // "TWILIOAUTH": "TODO",
                    "STARTUPMIN": props.startupMin.toString(),
                    "SHUTDOWNMIN": props.shutdownMin.toString()
                }
            },
            memoryLimitMiB: 2048,
            cpu: 1024
        });

        const dataVolumeName = "MinecraftDataVolume";

        service.taskDefinition.addVolume({
            name: dataVolumeName,
            efsVolumeConfiguration: {
                fileSystemId: fileSystemDetails.fileSystemId,
                authorizationConfig: {
                    accessPointId: fileSystemDetails.accessPointId
                },
                rootDirectory: "data"
            }
        });

        var serverContainer = service.taskDefinition.addContainer("MinecraftServerContainer", {
            containerName: "minecraft-server",
            image: ecs.ContainerImage.fromRegistry("itzg/minecraft-server"),
            portMappings: [
                { containerPort: 25565, hostPort: 25565 }
            ],
            environment: {
                "EULA": "TRUE"
            },
        });

        serverContainer.addMountPoints({
            sourceVolume: dataVolumeName,
            readOnly: false,
            containerPath: "/data",
        });

        // Allow the ECS task to publish to the SNS topic
        service.taskDefinition.addToTaskRolePolicy(new iam.PolicyStatement({
            actions: ["sns:Publish"],
            resources: [snsTopicArn]
        }));

        // Allow the ECS service to control itself
        service.taskDefinition.addToTaskRolePolicy(new iam.PolicyStatement({
            actions: ["ecs:*"],
            resources: [
                service.service.serviceArn,
                service.taskDefinition.taskDefinitionArn
            ]
        }));

        // Allow the ECS service to understand which network interface is attached to it in order to properly update the DNS records
        service.taskDefinition.addToTaskRolePolicy(new iam.PolicyStatement({
            actions: ["ec2:DescribeNetworkInterfaces"],
            resources: ["*"]
        }));

        // Escape hatch to set launch type to FARGATE_SPOT for cheaper run costs
        // const cfnService = service.node.tryFindChild('Service') as ecs.CfnService

        // cfnService.launchType = undefined
        // cfnService.capacityProviderStrategy = [
        //     {
        //         capacityProvider: 'FARGATE_SPOT',
        //         weight: 4,
        //     },
        //     {
        //         capacityProvider: 'FARGATE',
        //         weight: 1,
        //     },
        // ]
    }
}
