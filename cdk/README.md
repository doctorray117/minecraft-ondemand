# Welcome to the on-demand Minecraft server CDK deployment script!

This is a CDK project that deploys the infrastructure described in the excellent [on-demand Minecraft server](https://github.com/doctorray117/minecraft-ondemand) project.

## Pre-requisite software

The following software needs to be installed locally before deploying the project:

* NodeJS - Recommend [nvm](https://github.com/coreybutler/nvm-windows) to managed your NodeJS installations
* Yarn - Install using `npm install -g yarn`
* AWS CLI - Instructions can be found [here](https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html)
* AWS CDK - Install using `npm install -g aws-cdk`
* Docker - Installation instructions [here](https://docs.docker.com/desktop/windows/install/)

## Pre-requisite environment configuration
The only manual step required before deploying the server is to ensure the following have been setup in Route53:

* Hosted zone for the domain - the identifier of this hosted zone is used for the `domainHostedZoneId` configuration parameter
* A record for the subdomain - the name of this record is used for the `domainName` configuration parameter
* Query logging for the hosted zone - the name of the log group configured here is used for the `domainQueryLogGroupName` configuration parameter

See [here](https://github.com/doctorray117/minecraft-ondemand#route-53) for more details.

## Configuration

To configure the project, edit the configuration defined in the `bin\minecraft-ondemand.ts` file:

| Parameter | Description | Example |
| --------- | ----------- | ------- |
account                 | AWS account number to deploy to            | `123456789012`
region                  | Identifier of the AWS region to deploy to  | `ap-southeast-2`
clusterName             | Name of the ECS cluster                    | `minecraft`
serviceName             | Name of the ECS service                    | `minecraft-server`
vpcId                   | Identifier of an existing VPC to deploy to | `vpc-12c34d56`
domainName              | Name of the A record in the hosted zone to modify with the server's IP | `minecraft.mydomain.com`
domainHostedZoneId      | Identifier of the hosted zone that contains the A record for the DNS entry to update with the server's IP | `Z0123456A0EEAB01SG23`
domainQueryLogGroupName | The name of the log group that is capturing query events from the domain hosted zone | `/aws/route53/mydomain.com`
startupMin              | Number of minutes to wait for a connection after starting the server before terminating | `10`
shutdownMin             | Number of minutes to wait after the last client disconnects before terminating | `20`
serverEnvironment       | Additional environment variables used to configure the Minecraft server.  See [here](https://github.com/itzg/docker-minecraft-server#server-configuration) for details of the available options | Refer default configuration
notificationEmail       | (Optional) An email to send startup/shutdown server notifications to | `notifications@mydomain.com`
fargateSpotPercentage   | (Optional) A weighted value to indicate whether spot instances should be used to reduce costs.  A value of 100 means fargate spot instances will be used completely.  A value of 0, or omitting this parameter, will result in fargate instances being used.  Any value inbetween will result in a mix being used | `90`
enableFileSync          | (Optional) Whether or not to setup the tasks that allow syncing the EFS data with S3 (see here for details) | `true`

**NOTE** - Do **NOT** disable RCON in the `serverEnvironment` parameter! It is used by the watchdog to monitor connections and control the service

## Useful commands

 * `yarn deploy`     deploy this stack to your default AWS account/region
 * `yarn destroy`    deploy this stack to your default AWS account/region
 * `yarn diff`       compare deployed stack with current state
 * `yarn synth`      emits the synthesized CloudFormation template

## AWS CLI profile
An AWS CLI profile that contains credentials which allow access to the target account needs to be configured.
The rest of the instructions assume this profile will be called `minecraft`.
Refer [here](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-profiles.html) for details on how to setup a named profile.

## Bootstrap environment
Because a Lambda function is deployed to the `us-east-1` zone, it needs to be bootstrapped for the CDK deployment to succeed.  To do this, run the following command:

```cdk bootstrap aws://AWS_ACCOUNT_ID/us-east-1 --profile minecraft```

## Deploying the server
1. Make sure you are in the `cdk` folder of the repository (where this README.md is located)
1. Run `yarn install` to download the package dependencies
1. Ensure the required parameters have been configured for the target account
1. Ensure the `minecraft` named AWS CLI profile has been configured with valid credentials for the target account
1. Ensure that Docker is running locally
1. Run `yarn deploy` to deploy the resources in the target account

## Destroying the server
Run `yarn destroy` to remove the resources from the target account
