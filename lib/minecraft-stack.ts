import * as path from 'path';
import {
  Stack,
  StackProps,
  aws_ec2 as ec2,
  aws_efs as efs,
  aws_iam as iam,
  aws_ecs as ecs,
  aws_ssm as ssm,
  aws_logs as logs,
  RemovalPolicy,
  Fn,
  Arn,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { constants } from './constants';
import { SSMParameterReader } from './ssm-parameter-reader';
import { StackConfig } from './types';

interface MinecraftStackProps extends StackProps {
  config: Readonly<StackConfig>;
}

export class MinecraftStack extends Stack {
  constructor(scope: Construct, id: string, props: MinecraftStackProps) {
    super(scope, id, props);

    const { config } = props;

    const vpc = new ec2.Vpc(this, 'Vpc', {
      maxAzs: 3,
    });

    const fileSystem = new efs.FileSystem(this, 'FileSystem', {
      vpc,
      removalPolicy: RemovalPolicy.SNAPSHOT,
    });

    const accessPoint = new efs.AccessPoint(this, 'AccessPoint', {
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

    const efsReadWriteDataPolicy = new iam.Policy(this, 'DataRWPolicy', {
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

    const ecsTaskRole = new iam.Role(this, 'TaskRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      description: 'Minecraft ECS task role',
    });

    efsReadWriteDataPolicy.attachToRole(ecsTaskRole);

    const cluster = new ecs.Cluster(this, 'Cluster', {
      clusterName: constants.CLUSTER_NAME,
      vpc,
      containerInsights: true, // TODO: Add config for container insights
      enableFargateCapacityProviders: true,
    });

    const taskDefinition = new ecs.FargateTaskDefinition(
      this,
      'TaskDefinition',
      {
        taskRole: ecsTaskRole,
        memoryLimitMiB: config.taskMemory,
        cpu: config.taskCpu,
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

    const minecraftServerContainer = new ecs.ContainerDefinition(
      this,
      'ServerContainer',
      {
        containerName: constants.MC_SERVER_CONTAINER_NAME,
        image: ecs.ContainerImage.fromRegistry('itzg/minecraft-server'),
        portMappings: [
          { containerPort: 25565, hostPort: 25565, protocol: ecs.Protocol.TCP },
        ],
        environment: {
          EULA: 'TRUE',
        },
        essential: false,
        taskDefinition,
        logging: new ecs.AwsLogDriver({
          logRetention: logs.RetentionDays.THREE_DAYS,
          streamPrefix: constants.MC_SERVER_CONTAINER_NAME,
        }), // TODO: Add logging as optional with debug command
      }
    );

    minecraftServerContainer.addMountPoints({
      containerPath: '/data',
      sourceVolume: constants.ECS_VOLUME_NAME,
      readOnly: false,
    });

    const serviceSecurityGroup = new ec2.SecurityGroup(
      this,
      'ServiceSecurityGroup',
      {
        vpc,
        description: 'Security group for Minecraft on-demand',
      }
    );

    serviceSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(25565)
    );

    const minecraftServerService = new ecs.FargateService(
      this,
      'FargateService',
      {
        cluster,
        capacityProviderStrategies: [
          {
            capacityProvider: config.useFargateSpot
              ? 'FARGATE_SPOT'
              : 'FARGATE',
            weight: 1,
            base: 1,
          },
        ],
        taskDefinition: taskDefinition,
        platformVersion: ecs.FargatePlatformVersion.LATEST,
        serviceName: constants.SERVICE_NAME,
        desiredCount: 0,
        assignPublicIp: true,
        securityGroups: [serviceSecurityGroup],
      }
    );

    /* Allow access to EFS from Fargate service security group */
    fileSystem.connections.allowDefaultPortFrom(
      minecraftServerService.connections
    );

    const hostedZoneId = new SSMParameterReader(
      this,
      'Route53HostedZoneIdReader',
      {
        parameterName: constants.HOSTED_ZONE_SSM_PARAMETER,
        region: constants.DOMAIN_STACK_REGION,
      }
    ).getParameterValue();

    const watchdogContainer = new ecs.ContainerDefinition(
      this,
      'WatchDogContainer',
      {
        containerName: constants.WATCHDOG_SERVER_CONTAINER_NAME,
        image: ecs.ContainerImage.fromAsset(
          path.resolve(__dirname, '../minecraft-ecsfargate-watchdog/')
        ),
        essential: true,
        taskDefinition: taskDefinition,
        environment: {
          CLUSTER: constants.CLUSTER_NAME,
          SERVICE: constants.SERVICE_NAME,
          DNSZONE: hostedZoneId,
          SERVERNAME: `${config.subdomainPart}.${config.domainName}`,
          // TODO: Optional fields
          // SNSTOPIC: '',
          // TWILIOFROM: '',
          // TWILIOTO: '',
          // TWILIOAID: '',
          // TWILIOAUTH: '',
          STARTUPMIN: config.startupMinutes,
          SHUTDOWNMIN: config.shutdownMinutes,
        },
        logging: new ecs.AwsLogDriver({
          logRetention: logs.RetentionDays.THREE_DAYS,
          streamPrefix: constants.WATCHDOG_SERVER_CONTAINER_NAME,
        }), // TODO: Add logging as optional with debug command
      }
    );

    const serviceControlPolicy = new iam.Policy(this, 'ServiceControlPolicy', {
      statements: [
        new iam.PolicyStatement({
          sid: 'AllowAllOnServiceAndTask',
          effect: iam.Effect.ALLOW,
          actions: ['ecs:*'],
          resources: [
            minecraftServerService.serviceArn,
            // arn:aws:ecs:<region>:<account_number>:task/minecraft/
            Fn.join('/', [
              Arn.format({ resource: 'task', service: 'ecs' }, this),
              constants.CLUSTER_NAME,
              '*',
            ]),
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
      'launcherLambdaRoleArn',
      {
        parameterName: constants.LAUNCHER_LAMBDA_ARN_SSM_PARAMETER,
        region: constants.DOMAIN_STACK_REGION,
      }
    ).getParameterValue();
    const launcherLambdaRole = iam.Role.fromRoleArn(
      this,
      'LauncherLambdaRole',
      launcherLambdaRoleArn
    );
    serviceControlPolicy.attachToRole(launcherLambdaRole);

    /**
     * This policy gives permission to our ECS task to update the A record
     * associated with our minecraft server. Retrieve the hosted zone identifier
     * from Route 53 and place it in the Resource line within this policy.
     */
    const iamRoute53Policy = new iam.Policy(this, 'IamRoute53Policy', {
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
