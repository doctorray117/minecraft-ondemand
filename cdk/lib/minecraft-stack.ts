import * as path from 'path';
import {
    Stack,
    StackProps,
    aws_ec2 as ec2,
    aws_efs as efs,
    aws_iam as iam,
    aws_ecs as ecs,
    aws_logs as logs,
    aws_sns as sns,
    RemovalPolicy,
    Arn,
    ArnFormat,
} from 'aws-cdk-lib';
import {Construct} from 'constructs';
import {constants} from './constants';
import {SSMParameterReader} from './ssm-parameter-reader';
import {StackConfig} from './types';
import {getMinecraftServerConfig, isDockerInstalled} from './util';
import {Platform} from 'aws-cdk-lib/aws-ecr-assets';

interface MinecraftStackProps extends StackProps {
    config: Readonly<StackConfig>;
}

export class MinecraftStack extends Stack {
    constructor(scope: Construct, id: string, props: MinecraftStackProps) {
        super(scope, id, props);

        const {config} = props;

        const vpc = config.vpcId
            ? ec2.Vpc.fromLookup(this, 'Vpc', {vpcId: config.vpcId})
            : new ec2.Vpc(this, 'Vpc', {
                maxAzs: 3,
                natGateways: 0,
            });

        const ecsTaskRole = new iam.Role(this, 'TaskRole', {
            assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
            description: 'Minecraft ECS task role',
        });

        const cluster = new ecs.Cluster(this, 'Cluster', {
            clusterName: constants.CLUSTER_NAME,
            vpc,
            containerInsights: true, // TODO: Add config for container insights
            enableFargateCapacityProviders: true,
        });


        const serviceSecurityGroup = new ec2.SecurityGroup(
            this,
            'ServiceSecurityGroup',
            {
                vpc,
                description: 'Security group for Minecraft on-demand',
            }
        );


        for (const c of config.containerConfigs) {
            const fileSystem = new efs.FileSystem(this, `${c.prefix}FileSystem`, {
                vpc,
                removalPolicy: RemovalPolicy.SNAPSHOT,
            });

            const accessPoint = new efs.AccessPoint(this, `${c.prefix}AccessPoint`, {
                fileSystem,
                path: '/minecraft',
                posixUser: {
                    uid: '1000',
                    gid: '1000',
                },
                createAcl: {
                    ownerGid: '1000',
                    ownerUid: '1000',
                    permissions: '0755',
                },
            });

            const efsReadWriteDataPolicy = new iam.Policy(this, `${c.prefix}DataRWPolicy`, {
                statements: [
                    new iam.PolicyStatement({
                        sid: 'AllowReadWriteOnEFS',
                        effect: iam.Effect.ALLOW,
                        actions: [
                            'elasticfilesystem:ClientMount',
                            'elasticfilesystem:ClientWrite',
                            'elasticfilesystem:DescribeFileSystems',
                        ],
                        resources: [fileSystem.fileSystemArn],
                        conditions: {
                            StringEquals: {
                                'elasticfilesystem:AccessPointArn': accessPoint.accessPointArn,
                            },
                        },
                    }),
                ],
            });

            efsReadWriteDataPolicy.attachToRole(ecsTaskRole);

            const taskDefinition = new ecs.FargateTaskDefinition(
                this,
                `${c.prefix}TaskDefinition`,
                {
                    taskRole: ecsTaskRole,
                    memoryLimitMiB: c.taskMemory,
                    cpu: c.taskCpu,
                    volumes: [
                        {
                            name: constants.ECS_VOLUME_NAME,
                            efsVolumeConfiguration: {
                                fileSystemId: fileSystem.fileSystemId,
                                transitEncryption: 'ENABLED',
                                authorizationConfig: {
                                    accessPointId: accessPoint.accessPointId,
                                    iam: 'ENABLED',
                                },
                            },
                        },
                    ],
                }
            );

            const minecraftServerConfig = getMinecraftServerConfig(
                c.minecraftEdition
            );

            const minecraftServerContainer = new ecs.ContainerDefinition(
                this,
                `${c.prefix}ServerContainer`,
                {
                    containerName: constants.MC_SERVER_CONTAINER_NAME,
                    image: ecs.ContainerImage.fromRegistry(minecraftServerConfig.image),
                    portMappings: [
                        {
                            containerPort: minecraftServerConfig.port,
                            hostPort: minecraftServerConfig.port,
                            protocol: minecraftServerConfig.protocol,
                        },
                    ],
                    environment: c.minecraftImageEnv,
                    essential: false,
                    taskDefinition,
                    logging: c.debug
                        ? new ecs.AwsLogDriver({
                            logRetention: logs.RetentionDays.THREE_DAYS,
                            streamPrefix: constants.MC_SERVER_CONTAINER_NAME,
                        })
                        : undefined,
                }
            );

            minecraftServerContainer.addMountPoints({
                containerPath: '/data',
                sourceVolume: constants.ECS_VOLUME_NAME,
                readOnly: false,
            });


            serviceSecurityGroup.addIngressRule(
                ec2.Peer.anyIpv4(),
                minecraftServerConfig.ingressRulePort
            );

            const minecraftServerService = new ecs.FargateService(
                this,
                `${c.prefix}FargateService`,
                {
                    cluster,
                    capacityProviderStrategies: [
                        {
                            capacityProvider: c.useFargateSpot
                                ? 'FARGATE_SPOT'
                                : 'FARGATE',
                            weight: 1,
                            base: 1,
                        },
                    ],
                    taskDefinition: taskDefinition,
                    platformVersion: ecs.FargatePlatformVersion.LATEST,
                    serviceName: c.serviceName,
                    desiredCount: 0,
                    assignPublicIp: true,
                    securityGroups: [serviceSecurityGroup],
                }
            );

            /* Allow access to EFS from Fargate service security group */
            fileSystem.connections.allowDefaultPortFrom(
                minecraftServerService.connections
            );

            let snsTopicArn = '';
            /* Create SNS Topic if SNS_EMAIL is provided */
            if (c.snsEmailAddress) {
                const snsTopic = new sns.Topic(this, `${c.prefix}ServerSnsTopic`, {
                    displayName: 'Minecraft Server Notifications',
                });

                snsTopic.grantPublish(ecsTaskRole);

                const emailSubscription = new sns.Subscription(
                    this,
                    `${c.prefix}EmailSubscription`,
                    {
                        protocol: sns.SubscriptionProtocol.EMAIL,
                        topic: snsTopic,
                        endpoint: c.snsEmailAddress,
                    }
                );
                snsTopicArn = snsTopic.topicArn;
            }

            const hostedZoneId = new SSMParameterReader(
                this,
                `${c.prefix}Route53HostedZoneIdReader`,
                {
                    parameterName: c.prefix + constants.HOSTED_ZONE_SSM_PARAMETER,
                    region: constants.DOMAIN_STACK_REGION,
                }
            ).getParameterValue();

            const watchdogContainer = new ecs.ContainerDefinition(
                this,
                `${c.prefix}WatchDogContainer`,
                {
                    containerName: constants.WATCHDOG_SERVER_CONTAINER_NAME,
                    image: isDockerInstalled()
                        ? ecs.ContainerImage.fromAsset(
                            path.resolve(__dirname, '../../minecraft-ecsfargate-watchdog/'),
                            {
                                platform: Platform.LINUX_AMD64,
                            }
                        )
                        : ecs.ContainerImage.fromRegistry(
                            'doctorray/minecraft-ecsfargate-watchdog'
                        ),
                    essential: true,
                    taskDefinition: taskDefinition,
                    environment: {
                        CLUSTER: constants.CLUSTER_NAME,
                        SERVICE: c.serviceName,
                        DNSZONE: hostedZoneId,
                        SERVERNAME: `${c.subdomainPart}.${config.domainName}`,
                        SNSTOPIC: snsTopicArn,
                        TWILIOFROM: c.twilio.phoneFrom,
                        TWILIOTO: c.twilio.phoneTo,
                        TWILIOAID: c.twilio.accountId,
                        TWILIOAUTH: c.twilio.authCode,
                        STARTUPMIN: c.startupMinutes,
                        SHUTDOWNMIN: c.shutdownMinutes,
                    },
                    logging: c.debug
                        ? new ecs.AwsLogDriver({
                            logRetention: logs.RetentionDays.THREE_DAYS,
                            streamPrefix: constants.WATCHDOG_SERVER_CONTAINER_NAME,
                        })
                        : undefined,
                }
            );


            const serviceControlPolicy = new iam.Policy(this, `${c.prefix}ServiceControlPolicy`, {
                statements: [
                    new iam.PolicyStatement({
                        sid: 'AllowAllOnServiceAndTask',
                        effect: iam.Effect.ALLOW,
                        actions: ['ecs:*'],
                        resources: [
                            minecraftServerService.serviceArn,
                            /* arn:aws:ecs:<region>:<account_number>:task/minecraft/* */
                            Arn.format(
                                {
                                    service: 'ecs',
                                    resource: 'task',
                                    resourceName: `${constants.CLUSTER_NAME}/*`,
                                    arnFormat: ArnFormat.SLASH_RESOURCE_NAME,
                                },
                                this
                            ),
                        ],
                    }),
                    new iam.PolicyStatement({
                        effect: iam.Effect.ALLOW,
                        actions: ['ec2:DescribeNetworkInterfaces'],
                        resources: ['*'],
                    }),
                ],
            });

            serviceControlPolicy.attachToRole(ecsTaskRole);

            /**
             * Add service control policy to the launcher lambda from the other stack
             */
            const launcherLambdaRoleArn = new SSMParameterReader(
                this,
                `${c.prefix}launcherLambdaRoleArn`,
                {
                    parameterName: c.prefix + constants.LAUNCHER_LAMBDA_ARN_SSM_PARAMETER,
                    region: constants.DOMAIN_STACK_REGION,
                }
            ).getParameterValue();

            const launcherLambdaRole = iam.Role.fromRoleArn(
                this,
                `${c.prefix}LauncherLambdaRole`,
                launcherLambdaRoleArn
            );

            serviceControlPolicy.attachToRole(launcherLambdaRole);
            /**
             * This policy gives permission to our ECS task to update the A record
             * associated with our minecraft server. Retrieve the hosted zone identifier
             * from Route 53 and place it in the Resource line within this policy.
             */
            const iamRoute53Policy = new iam.Policy(this, `${c.prefix}IamRoute53Policy`, {
                statements: [
                    new iam.PolicyStatement({
                        sid: 'AllowEditRecordSets',
                        effect: iam.Effect.ALLOW,
                        actions: [
                            'route53:GetHostedZone',
                            'route53:ChangeResourceRecordSets',
                            'route53:ListResourceRecordSets',
                        ],
                        resources: [`arn:aws:route53:::hostedzone/${hostedZoneId}`],
                    }),
                ],
            });
            iamRoute53Policy.attachToRole(ecsTaskRole);
        }
    }
}
