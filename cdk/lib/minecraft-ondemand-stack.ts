import * as cdk from '@aws-cdk/core';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as efs from '@aws-cdk/aws-efs';
import * as ecs from '@aws-cdk/aws-ecs';
import * as sns from '@aws-cdk/aws-sns';
import * as iam from '@aws-cdk/aws-iam';

export interface MinecraftStackProps extends cdk.StackProps
{
    readonly clusterName: string;
    readonly serviceName: string;
    readonly vpcId: string;
    readonly domainHostedZoneId: string;
    readonly domainName: string;
    readonly startupMin: number;
    readonly shutdownMin: number;
    readonly notificationEmail?: string;
    readonly serverEnvironment: { [key: string]: string };
    readonly fargateSpotPercentage?: number;
}

interface FileSystemDetails
{
    readonly fileSystem: efs.FileSystem;
    readonly accessPointArn: string;
    readonly accessPointId: string;
}

const minecraftPort = 25565;

export class MinecraftStack extends cdk.Stack
{
    constructor(scope: cdk.Construct, id: string, props: MinecraftStackProps)
    {
        super(scope, id, props);

        const vpc = ec2.Vpc.fromLookup(this, "MinecraftVpc", { vpcId: props.vpcId });

        const fileSystemDetails = this.createFileSystem(vpc);

        this.createEcs(props, vpc, fileSystemDetails);
    }

    private createFileSystem(vpc: ec2.IVpc): FileSystemDetails
    {
        const fileSystem = new efs.FileSystem(this, 'MinecraftFileSystem', {
            vpc: vpc,
            // removalPolicy: cdk.RemovalPolicy.DELETE
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
            fileSystem: fileSystem,
            accessPointArn: accessPoint.accessPointArn,
            accessPointId: accessPoint.accessPointId
        };
    }

    private createSnsTopic(notificationEmail: string): string
    {
        const topic = new sns.Topic(this, "MinecraftTopic", {
            topicName: "minecraft-notifications",
            displayName: "Minecraft Notifications"
        });

        new sns.Subscription(this, "MinecraftEmailSubscription", {
            topic: topic,
            protocol: sns.SubscriptionProtocol.EMAIL,
            endpoint: notificationEmail,
        });

        return topic.topicArn;
    }

    private createEcs(props: MinecraftStackProps, vpc: ec2.IVpc, fileSystemDetails: FileSystemDetails)
    {
        let snsTopicArn: string | undefined;

        const cluster = new ecs.Cluster(this, "MinecraftCluster", {
            clusterName: props.clusterName,
            vpc: vpc,
            containerInsights: true
        });

        const taskDefinition = new ecs.FargateTaskDefinition(this, "MinecraftTaskDefinition", {
            memoryLimitMiB: 2048,
            cpu: 1024,
            family: "MinecraftTask",
        });

        const logDriver = new ecs.AwsLogDriver({ streamPrefix: "minecraft" });

        const additionalWatchdogEnvironment: { [key: string]: string; } = {};

        // If a notification email was provided, setup a subscription and configure the server to notify the user of events
        if (props.notificationEmail)
        {
            snsTopicArn = this.createSnsTopic(props.notificationEmail);

            additionalWatchdogEnvironment["SNSTOPIC"] = snsTopicArn;
        }

        const watchdogContainer = taskDefinition.addContainer("MinecraftWatchdogContainer", {
            containerName: "watchdog",
            image: ecs.ContainerImage.fromRegistry("doctorray/minecraft-ecsfargate-watchdog"),
            logging: logDriver,
            environment: {
                "CLUSTER": props.clusterName,
                "SERVICE": props.serviceName,
                "DNSZONE": props.domainHostedZoneId,
                "SERVERNAME": props.domainName,
                // "TWILIOFROM": "TODO",
                // "TWILIOTO": "TODO",
                // "TWILIOAID": "TODO",
                // "TWILIOAUTH": "TODO",
                "STARTUPMIN": props.startupMin.toString(),
                "SHUTDOWNMIN": props.shutdownMin.toString(),
                ...additionalWatchdogEnvironment
            }
        });

        const serverContainer = taskDefinition.addContainer("MinecraftServerContainer", {
            containerName: "server",
            image: ecs.ContainerImage.fromRegistry("itzg/minecraft-server"),
            logging: logDriver,
            environment: {
                "EULA": "TRUE",
                "OVERRIDE_SERVER_PROPERTIES": "TRUE",
                ...props.serverEnvironment
            },
            portMappings: [
                { containerPort: minecraftPort, hostPort: minecraftPort }
            ],
            essential: false
        });

        const service = new ecs.FargateService(this, "MinecraftService", {
            cluster: cluster,
            desiredCount: 0,
            taskDefinition: taskDefinition,
            assignPublicIp: true,
            serviceName: props.serviceName
        });

        const dataVolumeName = "MinecraftDataVolume";

        // TODO - This will generate a warning in the generated CFN due to CDK issue https://github.com/aws/aws-cdk/issues/15025
        taskDefinition.addVolume({
            name: dataVolumeName,
            efsVolumeConfiguration: {
                fileSystemId: fileSystemDetails.fileSystem.fileSystemId,
                transitEncryption: "ENABLED",
                authorizationConfig: {
                    accessPointId: fileSystemDetails.accessPointId
                }
            }
        });

        serverContainer.addMountPoints({
            sourceVolume: dataVolumeName,
            readOnly: false,
            containerPath: "/data"
        });

        // Allow the ECS task to publish to the SNS topic
        if (snsTopicArn)
        {
            service.taskDefinition.addToTaskRolePolicy(new iam.PolicyStatement({
                actions: ["sns:Publish"],
                resources: [snsTopicArn]
            }));
        }

        // Allow the ECS service to control itself
        taskDefinition.addToTaskRolePolicy(new iam.PolicyStatement({
            actions: ["ecs:*"],
            resources: [
                service.serviceArn,
                cdk.Arn.format({ service: "ecs", resource: "task", resourceName: "minecraft/*" }, this)
            ]
        }));

        // Allow the ECS service to understand which network interface is attached to it in order to properly update the DNS records
        taskDefinition.addToTaskRolePolicy(new iam.PolicyStatement({
            actions: ["ec2:DescribeNetworkInterfaces"],
            resources: ["*"]
        }));

        // Allow the ECS service to update the DNS record with the service IP address
        taskDefinition.addToTaskRolePolicy(new iam.PolicyStatement({
            actions: [
                "route53:GetHostedZone",
                "route53:ChangeResourceRecordSets",
                "route53:ListResourceRecordSets"
            ],
            resources: [
                cdk.Arn.format({ service: "route53", account: "", region: "", resource: "hostedzone", resourceName: props.domainHostedZoneId }, this)
            ]
        }));

        // Allow the ECS service to get a list of hosted zones from Route53
        taskDefinition.addToTaskRolePolicy(new iam.PolicyStatement({
            actions: ["route53:ListHostedZones"],
            resources: ["*"]
        }));

        // Allow the ECS service to access the EFS volume
        taskDefinition.addToTaskRolePolicy(new iam.PolicyStatement({
            actions: [
                "elasticfilesystem:ClientMount",
                "elasticfilesystem:ClientWrite",
                "elasticfilesystem:DescribeFileSystems"],
            resources: [fileSystemDetails.fileSystem.fileSystemArn],
            conditions: {
                "StringEquals": {
                    "elasticfilesystem:AccessPointArn": fileSystemDetails.accessPointArn
                }
            }
        }));

        // Open the NFS port so that the service can connect to the EFS volume
        service.connections.allowFrom(fileSystemDetails.fileSystem, ec2.Port.tcp(2049), "Allow the Minecraft server to read from the EFS volume");
        fileSystemDetails.fileSystem.connections.allowFrom(service, ec2.Port.tcp(2049), "Allow the Minecraft server to write to the EFS volume");

        // Add an inbound rule on the service security group to allow connections to the server
        service.connections.allowFromAnyIpv4(ec2.Port.tcp(minecraftPort), "Minecraft server listen port for client connections");

        // Escape hatch to set launch type to FARGATE_SPOT for cheaper run costs
        if (props.fargateSpotPercentage && props.fargateSpotPercentage > 0 && props.fargateSpotPercentage <= 100)
        {
            const cfnService = service.node.tryFindChild('Service') as ecs.CfnService;

            cfnService.launchType = undefined;
            cfnService.capacityProviderStrategy = [
                {
                    capacityProvider: 'FARGATE_SPOT',
                    weight: props.fargateSpotPercentage,
                },
                {
                    capacityProvider: 'FARGATE',
                    weight: 100 - props.fargateSpotPercentage,
                },
            ];
        }
    }
}
