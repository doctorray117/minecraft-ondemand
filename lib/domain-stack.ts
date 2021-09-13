import * as path from 'path';
import {
  Stack,
  StackProps,
  aws_lambda as lambda,
  aws_route53 as route53,
  aws_logs as logs,
  aws_ssm as ssm,
  aws_iam as iam,
  aws_logs_destinations as logDestinations,
  custom_resources as cr,
  Duration,
  RemovalPolicy,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { constants } from './constants';
import { config } from './config';

export class DomainStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const domainName = config.DOMAIN_NAME;

    const queryLogGroup = new logs.LogGroup(this, 'LogGroup', {
      logGroupName: `/aws/route53/${domainName}`,
      retention: 3,
      removalPolicy: RemovalPolicy.DESTROY,
    });
    /**
     * Cloudwatch logs have global resource policies that allow EventBridge to
     * write logs to a given Cloudwatch Log group. This is currently not
     * implemented with CDK, so we use a Custom Resource here.
     * See https://github.com/aws/aws-cdk/issues/5343
     */
    const policyName = 'cw.r.route53-dns';
    const putResourcePolicy: cr.AwsSdkCall = {
      service: 'CloudWatchLogs',
      action: 'putResourcePolicy',
      parameters: {
        policyName,
        /**
         * PolicyDocument must be provided as a string, so we can't use the
         * iam.PolicyDocument provisions or other CDK niceties here.
         */
        policyDocument: JSON.stringify({
          Version: '2012-10-17',
          Statement: [
            {
              Sid: policyName,
              Effect: 'Allow',
              Principal: {
                Service: ['route53.amazonaws.com'],
              },
              Action: ['logs:CreateLogStream', 'logs:PutLogEvents'],
              Resource: `arn:aws:logs:${this.region}:${this.account}:log-group:*`,
            },
          ],
        }),
      },
      physicalResourceId: cr.PhysicalResourceId.of(policyName),
    };

    const cloudwatchLogResourcePolicy = new cr.AwsCustomResource(
      this,
      'CloudwatchLogResourcePolicy',
      {
        resourceType: 'Custom::CloudwatchLogResourcePolicy',
        onCreate: putResourcePolicy,
        onUpdate: putResourcePolicy,
        onDelete: {
          service: 'CloudWatchLogs',
          action: 'deleteResourcePolicy',
          parameters: {
            policyName,
          },
        },
        timeout: Duration.minutes(2),
        policy: cr.AwsCustomResourcePolicy.fromSdkCalls({
          resources: cr.AwsCustomResourcePolicy.ANY_RESOURCE,
        }),
      }
    );

    const zone = new route53.HostedZone(this, 'HostedZone', {
      zoneName: domainName,
      queryLogsLogGroupArn: queryLogGroup.logGroupArn,
    });

    // Resource policy for CloudWatch Logs is needed before the zone can be created
    zone.node.addDependency(cloudwatchLogResourcePolicy);

    const aRecord = new route53.ARecord(this, 'ARecord', {
      target: {
        /**
         * The value of the record is irrelevant because it will be updated
         * every time our container launches.
         */
        values: ['192.168.1.1'],
      },
      /**
       * The low TTL is so that the DNS clients and non-authoritative DNS
       * servers won't cache the record long and you can connect quicker after
       * the IP updates.
       */
      ttl: Duration.seconds(30),
      recordName: domainName,
      zone,
    });

    const launcherLambda = new lambda.Function(this, 'LauncherLambda', {
      code: lambda.Code.fromAsset(path.resolve(__dirname, '../lambda')),
      handler: 'lambda_function.lambda_handler',
      runtime: lambda.Runtime.PYTHON_3_8,
      environment: {
        REGION: config.SERVER_REGION,
        CLUSTER: constants.CLUSTER_NAME,
        SERVICE: constants.SERVICE_NAME,
      },
      logRetention: logs.RetentionDays.THREE_DAYS, // TODO: parameterize
    });

    /**
     * Give cloudwatch permission to invoke our lambda when our subscription filter
     * picks up DNS queries.
     */
    launcherLambda.addPermission('CWPermission', {
      principal: new iam.ServicePrincipal(`logs.${constants.DOMAIN_STACK_REGION}.amazonaws.com`),
      action: 'lambda:InvokeFunction',
      sourceAccount: this.account,
      sourceArn: queryLogGroup.logGroupArn, // TODO: Validate if this needs ':*' suffix
    });

    /**
     * Create our log subscription filter to catch any log events containing
     * our domain name and send them to our launcher lambda.
     */
    queryLogGroup.addSubscriptionFilter('SubscriptionFilter', {
      destination: new logDestinations.LambdaDestination(launcherLambda),
      filterPattern: logs.FilterPattern.anyTerm(config.DOMAIN_NAME),
    });

    /**
     * Add the hosted zone ID to SSM since we cannot consume a cross-stack
     * references across regions.
     */
    new ssm.StringParameter(this, 'HostedZoneParam', {
      allowedPattern: '.*',
      description: 'Hosted zone ID for minecraft server',
      parameterName: constants.HOSTED_ZONE_SSM_PARAMETER,
      stringValue: zone.hostedZoneId,
    });

    /**
     * Add the ARN for the launcher lambda execution role to SSM so we can
     * attach the policy for accessing the minecraft server after it has been
     * created.
     */
    new ssm.StringParameter(this, 'LauncherLambdaParam', {
      allowedPattern: '.*\S.*',
      description: 'Minecraft launcher execution role ARN',
      parameterName: constants.LAUNCHER_LAMBDA_ARN_SSM_PARAMETER,
      stringValue: launcherLambda.role?.roleArn || '',
    });
  }
}
