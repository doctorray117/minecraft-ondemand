# minecraft-ondemand: AWS Cloud Development Kit (CDK)

> Quick and easy deployment of an on-demand Minecraft server with configurable
> settings using [AWS CDK](https://aws.amazon.com/cdk/).

## Requirements

- Node.js version 10 or later
- AWS Account
- AWS CLI installed and configured
- Domain name with public DNS served from Route 53

**Note: Installing CDK is not required and is included in the node dependencies.**

## Usage

### 1. Clone the repository

Clone the `minecraft-ondemand` GitHub repository.

```bash
git clone https://github.com/doctorray117/minecraft-ondemand.git
```

### 2. Set the required configuration values

Copy `.env.sample` at the root of this repo and save it as `.env`:

```bash
cp .env.sample .env
```

The only **required** configuration value is `DOMAIN_NAME`. This value should be
the domain name of your existing Route53 hosted zone. An NS record will be added
to this hosted zone after CDK creates a hosted zone to handle the
subdomain (defaults to `minecraft`).

See the section on [Configuration](#configuration) for more configuration options.

### 3. Build and Deploy

Build and deploy the solution by running:

```bash
npm run build && npm run deploy
```

## Configuration

| Config           | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Default     |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------- |
| DOMAIN_NAME      | Domain name of existing Route53 Hosted Zone.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |             |
| SUBDOMAIN_PART   | Name of the subdomain part to be used for creating a delegated hosted zone (minecraft.example.com) and an NS record on your existing (example.com) hosted zone. This subdomain should not already be in use.                                                                                                                                                                                                                                                                                                                               | `minecraft` |
| SERVER_REGION    | The AWS region to deploy your minecraft server in.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | `us-east-1` |
| STARTUP_MINUTES  | Number of minutes to wait for a connection after starting before terminating                                                                                                                                                                                                                                                                                                                                                                                                                                                               | `10`        |
| SHUTDOWN_MINUTES | Number of minutes to wait after the last client disconnects before terminating                                                                                                                                                                                                                                                                                                                                                                                                                                                             | `20`        |
| USE_FARGATE_SPOT | Sets the preference for Fargate Spot. <br />If you leave it 'false', your tasks will launch under the FARGATE strategy which currently will run about 5 cents per hour. You can switch it to true to enable FARGATE_SPOT, and pay 1.5 cents per hour. While this is cheaper, technically AWS can terminate your instance at any time if they need the capacity. The watchdog is designed to intercept this termination command and shut down safely, it's fine to use Spot to save a few pennies, at the extremely low risk of game interruption. | `false`     |
| TASK_MEMORY      | The amount (in MiB) of memory used by the task running the Minecraft server.                                                                                                                                                                                                                                                                                                                                                                                                                                                               | `2048`      |
| TASK_CPU         | The number of cpu units used by the task running the Minecraft server.                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | `1024`      |

## Cleanup

To remove all of the resources that were deployed on the deploy script run the
following command:

```bash
npm run destroy
```

Note: Unless you changed the related configuration values, **running this script
will delete everything deployed by this template including your minecraft server
data**.

Alternatively, you can delete the `minecraft-server-stack` first, then the
`minecraft-domain-stack` from the [AWS Console](https://console.aws.amazon.com/cloudformation/).

## Advanced Usage

## FAQ

## Troubleshooting

TODO: Add statement about DEBUG mode

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
