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

TODO: Description of where the configuration lives and how to change values

#### Domain Name

**Config:** `DOMAIN_NAME`

**Description:** The domain name of your existing Route53 hosted zone. A NS record
will be added to this hosted zone after CDK creates a hosted zone to handle the
subdomain (deafults to `minecraft`).

For example, if your existing Route53 Hosted Zone domain name is `example.com`,
the domain for accessing your Minecraft server will be `minecraft.example.com`.

#### AWS Region

**Config:** `SERVER_REGION`

**Description:** The AWS Region to deploy the Minecraft server in, ideally this
would be the region closest to you or the players on your server. If no value is
provided, this will default to the region specified for your AWS CLI profile.

#### Additional configuration (optional)

Optionally, you can change the following values for additional customization:

| Option | Description | Default |
| ------ | ----------- | ------- |
|        |             |         |

### 3. Build and Deploy

Build and deploy the solution by running:

```bash
npm run build && npm run deploy
```

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
