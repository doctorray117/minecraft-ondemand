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

**Description:** This will be the name of the hosted zone that will be created
and where the A record will point to your minecraft server at.

This value must include a subdomain for a zone you already have hosted.

For example, if you already have a hosted zone for `example.com`, you would set
`DOMAIN_NAME` to `minecraft.example.com`.

#### AWS Region

**Config:** `SERVER_REGION`

**Description:** The AWS Region to deploy the Minecraft server in, ideally this would be the region
closest to you or the players on your server. If no value is provided, this will
default to the region specified for your AWS CLI profile.

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

## Advanced Usage

## FAQ

## Troubleshooting
