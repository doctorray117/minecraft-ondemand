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
  Duration,
  RemovalPolicy,
  Arn,
  ArnFormat,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { constants } from './constants';
import { CWGlobalResourcePolicy } from './cw-global-resource-policy';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';
import { StackConfig } from './types';

interface DomainStackProps extends StackProps {
  config: Readonly<StackConfig>;
}

export class DomainStack extends Stack {
  constructor(scope: Construct, id: string, props: DomainStackProps) {
    super(scope, id, props);

    const { config } = props;

    const subdomain = `${config.subdomainPart}.${config.domainName}`;

    const queryLogGroup = new logs.LogGroup(this, 'LogGroup', {
      logGroupName: `/aws/route53/${subdomain}`,
      retention: RetentionDays.THREE_DAYS,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    /* Create policy to allow route53 to log to cloudwatch */
    const policyName = 'cw.r.route53-dns';
    const dnsWriteToCw = [
      new iam.PolicyStatement({
        sid: 'AllowR53LogToCloudwatch',
        effect: iam.Effect.ALLOW,
        principals: [new iam.ServicePrincipal('route53.amazonaws.com')],
        actions: ['logs:CreateLogStream', 'logs:PutLogEvents'],
        resources: [
          Arn.format(
            {
              resource: 'log-group',
              service: 'logs',
              resourceName: '*',
              arnFormat: ArnFormat.COLON_RESOURCE_NAME,
            },
            this
          ),
        ],
      }),
    ];
    const cloudwatchLogResourcePolicy = new CWGlobalResourcePolicy(
      this,
      'CloudwatchLogResourcePolicy',
      { policyName, statements: dnsWriteToCw }
    );

    const rootHostedZone = route53.HostedZone.fromLookup(this, 'HostedZone', {
      domainName: config.domainName,
    });

    const subdomainHostedZone = new route53.HostedZone(
      this,
      'SubdomainHostedZone',
      {
        zoneName: subdomain,
        queryLogsLogGroupArn: queryLogGroup.logGroupArn,
      }
    );

    /* Resource policy for CloudWatch Logs is needed before the zone can be created */
    subdomainHostedZone.node.addDependency(cloudwatchLogResourcePolicy);
    /* Ensure we hvae an existing hosted zone before creating our delegated zone */
    subdomainHostedZone.node.addDependency(rootHostedZone);

    const nsRecord = new route53.NsRecord(this, 'NSRecord', {
      zone: rootHostedZone,
      values: subdomainHostedZone.hostedZoneNameServers as string[],
      recordName: subdomain,
    });

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
      recordName: subdomain,
      zone: subdomainHostedZone,
    });

    /* Set dependency on A record to ensure it is removed first on deletion */
    aRecord.node.addDependency(subdomainHostedZone);

    const launcherLambda = new lambda.Function(this, 'LauncherLambda', {
      code: lambda.Code.fromAsset(path.resolve(__dirname, '../../lambda')),
      handler: 'lambda_function.lambda_handler',
      runtime: lambda.Runtime.PYTHON_3_8,
      environment: {
        REGION: config.serverRegion,
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
      principal: new iam.ServicePrincipal(
        `logs.${constants.DOMAIN_STACK_REGION}.amazonaws.com`
      ),
      action: 'lambda:InvokeFunction',
      sourceAccount: this.account,
      sourceArn: queryLogGroup.logGroupArn,
    });

    /**
     * Create our log subscription filter to catch any log events containing
     * our subdomain name and send them to our launcher lambda.
     */
    queryLogGroup.addSubscriptionFilter('SubscriptionFilter', {
      destination: new logDestinations.LambdaDestination(launcherLambda),
      filterPattern: logs.FilterPattern.anyTerm(subdomain),
    });

    /**
     * Add the subdomain hosted zone ID to SSM since we cannot consume a cross-stack
     * references across regions.
     */
    new ssm.StringParameter(this, 'HostedZoneParam', {
      allowedPattern: '.*',
      description: 'Hosted zone ID for minecraft server',
      parameterName: constants.HOSTED_ZONE_SSM_PARAMETER,
      stringValue: subdomainHostedZone.hostedZoneId,
    });

    /**
     * Add the ARN for the launcher lambda execution role to SSM so we can
     * attach the policy for accessing the minecraft server after it has been
     * created.
     */
    new ssm.StringParameter(this, 'LauncherLambdaParam', {
      allowedPattern: '.*S.*',
      description: 'Minecraft launcher execution role ARN',
      parameterName: constants.LAUNCHER_LAMBDA_ARN_SSM_PARAMETER,
      stringValue: launcherLambda.role?.roleArn || '',
    });
  }
}
