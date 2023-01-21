import { custom_resources as cr, aws_iam as iam, Duration } from 'aws-cdk-lib';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

interface CWGlobalResourcePolicyProps {
  statements: iam.PolicyStatement[];
  policyName: string;
}

/**
 * Cloudwatch logs have global resource policies that allow EventBridge to
 * write logs to a given Cloudwatch Log group. This is currently not
 * implemented with CDK, so we use a Custom Resource here.
 * See https://github.com/aws/aws-cdk/issues/5343
 */
export class CWGlobalResourcePolicy extends cr.AwsCustomResource {
  constructor(
    scope: Construct,
    name: string,
    props: CWGlobalResourcePolicyProps
  ) {
    const { statements, policyName } = props;

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
          Statement: statements,
        }),
      },
      physicalResourceId: cr.PhysicalResourceId.of(policyName),
    };

    const deleteResourcePolicy: cr.AwsSdkCall = {
      service: 'CloudWatchLogs',
      action: 'deleteResourcePolicy',
      parameters: {
        policyName,
      },
    };

    super(scope, name, {
      onUpdate: putResourcePolicy,
      onCreate: putResourcePolicy,
      onDelete: deleteResourcePolicy,
      timeout: Duration.minutes(2),
      policy: cr.AwsCustomResourcePolicy.fromSdkCalls({
        resources: cr.AwsCustomResourcePolicy.ANY_RESOURCE,
      }),
      logRetention: RetentionDays.THREE_DAYS,
    });
  }
}
