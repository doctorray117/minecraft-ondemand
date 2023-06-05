# minecraft-ondemand: AWS Cloud Development Kit (CDK)

> Quick and easy deployment of an on-demand Minecraft server with configurable
> settings using [AWS CDK].

# Introduction

Cloud Development Kit (CDK) is a relatively easy way to deploy infrastructure as code.  Within the context of this project, this is a CDK implementation of almost all of the required items to bring up and operate this project with some customizations.  This guide is built for beginners and is tailored toward a Windows experience.  Advanced or Linux users can gloss over the stuff that doesn't apply to them.

# Quickest Start (Windows)
Linux friends should be able to adapt this to their needs.

## Prerequisites

1. [Open an AWS Account]
2. [Create an Admin IAM User] (Download and save the Access Key and Secret Key).  Alternatively you can generate Access Keys for your root user, but this is bad practice.
3. [Install AWS CLI] and [configure it] with the keys from step 2.  Specifying the default region and output format are optional.
4. [Pick](https://domains.google) [a](https://namecheap.com) [registrar](https://networksolutions.com) [and](https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/domain-register.html) [register](https://domain.com) [a](https://register.com) [domain](https://godaddy.com) [name](https://enom.com).
5. [Create a public hosted zone] for your domain name in Route 53.
6. [Change the DNS servers] for your new domain to the ones listed in the Route 53 console from step 5.
7. Install [NodeJS] (say yes to the chocolatey option)
8. Install [Git] (Pick Notepad or Notepad++ for an editor even though you probably don't need to use it, all other defaults fine)

## Procedure

### 1. Clone the repository

Open the a command prompt shell (perhaps the new "Node.js command prompt" icon in your start menu) and clone the `minecraft-ondemand` GitHub repository.

```bash
git clone https://github.com/doctorray117/minecraft-ondemand.git
```

### 2. Change to the CDK directory, create the environment file, and open it in an editor

```bash
cd minecraft-ondemand
cd cdk
copy .env.sample .env
notepad .env
```
(replace `notepad` with your favorite text editor)

### 3. Set the required configuration values

The only **required** configuration value is `DOMAIN_NAME`.  This value should be the exact domain name you purchased and set up in Route53.  During setup, a dedicated subdomain zone will be added and an NS record will be added to this root zone.

Setting an email address for an SNS topic is recommended.

See the section on [Configuration](#configuration) for more configuration options.

### 4. Build and Deploy

All of the subsequent steps assume you are running from a terminal/command prompt window inside of the cdk directory.  Windows users might use the `Node.js command prompt` item in the start menu.

Build and deploy the solution by running:

```bash
npm run build && npm run deploy
```

You may be asked to install a package like aws-cdk, this is fine to say yes to.  The full deployment will take a few minutes.

### 5. Customize your server

After you've launched your minecraft server the first time and you've waited for it to finishing generating the world with all defaults, you'll need to get in, make yourself an op, tweak settings, etc.  There are several ways to do this, many of which are outlined at [Usage and Customization] on the main page.

## Additional Configuration

Configuration values can all be passed in as environment variables or by using a 
`.env` file created from [`.env.sample`](./.env.sample). 

**Note:** Environment variables will take precedence over configuration values
set in `.env`.

| Config                        | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Default              |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| DOMAIN_NAME                   | **Required** Domain name of existing Route53 Hosted Zone.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | --                   |
| SUBDOMAIN_PART                | Name of the subdomain part to be used for creating a delegated hosted zone (minecraft.example.com) and an NS record on your existing (example.com) hosted zone. This subdomain should not already be in use.                                                                                                                                                                                                                                                                                                                                               | `minecraft`          |
| SERVER_REGION                 | The AWS region to deploy your minecraft server in.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | `us-east-1`          |
| MINECRAFT_EDITION             | Edition of Minecraft server to run. Accepted values are are `java` or `bedrock` for [Minecraft Java Docker] or [Minecraft Bedrock Docker], respectively.                                                                                                                                                                                                                                                                                                                                                                                                   | `java`               |
| STARTUP_MINUTES               | Number of minutes to wait for a connection after starting before terminating                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | `10`                 |
| SHUTDOWN_MINUTES              | Number of minutes to wait after the last client disconnects before terminating                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | `20`                 |
| USE_FARGATE_SPOT              | Sets the preference for Fargate Spot. <br /><br />If you set it as `false`, your tasks will launch under the `FARGATE` strategy which currently will run about 5 cents per hour. You can leave it as `true` to use `FARGATE_SPOT`, and pay 1.5 cents per hour. While this is cheaper, technically AWS can terminate your instance at any time if they need the capacity. The watchdog is designed to intercept this termination command and shut down safely, it's fine to use Spot to save a few pennies, at the extremely low risk of game interruption. | `true`               |
| TASK_MEMORY                   | The amount (in MiB) of memory used by the task running the Minecraft server.                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | `2048`               |
| TASK_CPU                      | The number of cpu units used by the task running the Minecraft server.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | `1024`               |
| VPC_ID                        | VPC ID to deploy your server in. When this value is not specified, a new VPC is automatically created by default.                                                                                                                                                                                                                                                                                                                                                                                                                                          | --                   |
| MINECRAFT_IMAGE_ENV_VARS_JSON | Additional environment variables to be passed to the [Minecraft Java Docker] or [Minecraft Bedrock Docker]. Value is specified as inline JSON.                                                                                                                                                                                                                                                     | `{ "EULA": "TRUE" }` |
| SNS_EMAIL_ADDRESS             | The email address you would like to receive server notifications at. <br /><br />If this value is specified, an SNS topic is created and you will receive email notifications each time the minecraft server is launched and ready.                                                                                                                                                                                                                                                                                                                        | --                   |
| TWILIO_PHONE_FROM             | Your twilio phone number. (i.e `+1XXXYYYZZZZ`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | --                   |
| TWILIO_PHONE_TO               | Phone number to receive text notifications at.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | --                   |
| TWILIO_ACCOUNT_ID             | Twilio account ID.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | --                   |
| TWILIO_AUTH_CODE              | Twilio auth code.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | --                   |
| DEBUG                         | Enables debug mode.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | --                   |
| CDK_NEW_BOOTSTRAP             | Addresses issue for some users relating to AWS move to bootstrap v2.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | `1`                  |

## Cleanup

To remove all of the resources that were deployed on the deploy script run the following command:

```bash
npm run destroy
```

Note: Unless you changed the related configuration values, **running this script
will delete everything deployed by this template including your minecraft server
data**.

Alternatively, you can delete the `minecraft-server-stack` first, then the
`minecraft-domain-stack` from the [AWS Console](https://console.aws.amazon.com/cloudformation/).

Note: the Route53 A record will need to be manually reset to 192.168.1.1 in order for CDK to properly destroy the resources.  This will be fixed later.

## Troubleshooting

Set the `DEBUG` value in your [configuration](#configuration) to `true` to enable the following:

- CloudWatch Logs for the `minecraft-server` ECS Container
- CloudWatch Logs for the `minecraft-ecsfargate-watchdog` ECS Container

### No Fargate configuration exists for given values

There are limited memory and vCPU configurations which are support by Fargate, in your `.env` ensure that you're using values supported here:

| CPU (TASK_CPU) | Memory (TASK_MEMORY)            |
|----------------|---------------------------------|
| 256            | 512, 1024, 2048                 |
| 512            | 1024 - 4096 in 1024 increments  |
| 1024           | 2048 - 8192 in 1024 increments  |
| 2048           | 4096 - 16384 in 1024 increments |
| 4096           | 8192 - 30720 in 1024 increments |

`1024` is equal to one vCPU or GB. For example, if I wanted 2 virtual cores and 8GB memory, this would be my `.env` configuration:

```
TASK_MEMORY                   = 8192
TASK_CPU                      = 2048
```

See [Invalid CPU or memory value specified](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task-cpu-memory-error.html) for more details

### The specified hosted zone does not exist

**Error Message:**

> The specified hosted zone does not exist. (Service: AmazonRoute53; Status Code: 404; Error Code: NoSuchHostedZone;...

**Cause:**

CDK is unable to find a Hosted Zone created with the domain matching your value
set to `DOMAIN_NAME`.

**Troubleshoot:**

Check the [Hosted Zones](https://console.aws.amazon.com/route53/v2/hostedzones#)
tab in the AWS Console and make sure the configuration value set for `DOMAIN_NAME`
matches the domain name found in the console.

### cdk destroy fails

Most CDK destroy failures can be resolved by running it a second time.  Other reasons may include:

- Did you reset the Route53 A record back to 192.168.1.1?  This is a temporary problem but currently required.  If you attempted destroy before doing this then just delete the record and run destroy again.
- Is your task still running?
- Any manual changes in the console may require manual deletion or changeback for destroy to work properly

  [AWS CDK]: <https://aws.amazon.com/cdk/>
  [Open an AWS Account]: <https://aws.amazon.com/premiumsupport/knowledge-center/create-and-activate-aws-account/>
  [Install AWS CLI]: <https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html>
  [Create an Admin IAM User]: <https://docs.aws.amazon.com/IAM/latest/UserGuide/getting-started_create-admin-group.html>
  [configure it]: <https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-quickstart.html>
  [Create a public hosted zone]: <https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/CreatingHostedZone.html>
  [Change the DNS servers]: <https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/migrate-dns-domain-inactive.html#migrate-dns-update-domain-inactive>
  [NodeJS]: <https://nodejs.org/en/download/>
  [Git]: <https://git-scm.com/download/win>
  [Usage and Customization]: <https://github.com/doctorray117/minecraft-ondemand#usage-and-customization>
  [minecraft java docker]: https://hub.docker.com/r/itzg/minecraft-server
  [minecraft bedrock docker]: https://hub.docker.com/r/itzg/minecraft-bedrock-server
