import { Vpc } from '@aws-cdk/aws-ec2';
import { Construct, Stack, StackProps } from '@aws-cdk/core';

export interface MinecraftStackProps extends StackProps
{
    vpcId: string;
}

export class MinecraftStack extends Stack
{
    constructor(scope: Construct, id: string, props: MinecraftStackProps)
    {
        super(scope, id, props);

        const vpc = Vpc.fromLookup(this, "MinecraftVpc", { vpcId: props.vpcId });
    }
}
