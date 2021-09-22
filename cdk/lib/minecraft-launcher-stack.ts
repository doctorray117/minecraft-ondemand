import * as cdk from '@aws-cdk/core';
import * as iam from '@aws-cdk/aws-iam';
import * as lambda from "@aws-cdk/aws-lambda";
import * as fn from '@aws-cdk/aws-lambda-python';
import * as log from '@aws-cdk/aws-logs';
import { LambdaDestination } from '@aws-cdk/aws-logs-destinations';

export interface MinecraftLauncherStackProps extends cdk.StackProps
{
    readonly clusterName: string;
    readonly serviceName: string;
    readonly serverRegion: string;
    readonly domainName: string;
    readonly domainQueryLogGroupName: string;
}

export class MinecraftLauncherStack extends cdk.Stack
{
    constructor(scope: cdk.Construct, id: string, props: MinecraftLauncherStackProps)
    {
        super(scope, id, props);

        this.createFunction(props);
    }

    private createFunction(props: MinecraftLauncherStackProps)
    {
        const launcherFunction = new fn.PythonFunction(this, 'MinecraftLauncherFunction', {
            entry: '../lambda',
            index: 'lambda_function.py',
            handler: 'lambda_handler',

            runtime: lambda.Runtime.PYTHON_3_9,
            environment: {
                "REGION_NAME": props.serverRegion,
                "CLUSTER_NAME": props.clusterName,
                "SERVICE_NAME": props.serviceName
            }
        });

        const serviceArn = cdk.Arn.format({
            region: props.serverRegion,
            service: "ecs",
            resource: "service",
            resourceName: `${props.clusterName}/${props.serviceName}`
        }, this);

        // Allow the lambda function to control the ECS service
        launcherFunction.addToRolePolicy(new iam.PolicyStatement({
            actions: ["ecs:*"],
            resources: [serviceArn]
        }));

        const logGroup = log.LogGroup.fromLogGroupName(this, "DomainQueryLogGroup", props.domainQueryLogGroupName);
        const lambdaDestination = new LambdaDestination(launcherFunction);
        
        new log.SubscriptionFilter(this, "MinecraftLauncherSubscriptionFilter", {
            logGroup: logGroup,
            destination: lambdaDestination,
            filterPattern: log.FilterPattern.anyTerm(props.domainName)
        });
    }
}
