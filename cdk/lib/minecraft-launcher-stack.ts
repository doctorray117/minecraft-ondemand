import * as cdk from '@aws-cdk/core';
import * as iam from '@aws-cdk/aws-iam';
import * as lambda from "@aws-cdk/aws-lambda";
import * as fn from '@aws-cdk/aws-lambda-python';
import { Arn } from '@aws-cdk/core';

export interface MinecraftLauncherStackProps extends cdk.StackProps
{
    readonly clusterName: string;
    readonly serviceName: string;
    readonly serverRegion: string;
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

        const serviceArn = Arn.format({
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
    }
}