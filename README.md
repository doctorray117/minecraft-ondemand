# minecraft-ondemand
Almost free serverless on-demand Minecraft server in AWS

## Background
Instead of paying a minecraft hosting service for a private server for you and your friends, host it yourself.  By utilizing several AWS services, a minecraft server can automatically start when you're ready to use it, and shut down when you are done.  The final cost will depend on use but can be as little as a a dollar or two per month.  The cost estimate breakdown is below.

## Workflow
The process works as follows:
1. Open Minecraft Multiplayer, let it look for our server, it will fail.
2. The DNS lookup query is logged in Route53 on our public hosted zone.
3. CloudWatch forwards the query to a Lambda function.
4. The Lambda function modifies an existing ECS Fargate service to a desired task count of 1.
5. Fargate launches two containers, Minecraft and a watchdog.
6. The watchdog optionally sends a text message through Twilio when the server is ready.
7. Refresh Minecraft server list, server is ready to connect.
8. After 10 minutes without a connection or 20 minutes after the last client disconnects (customizable) the watchdog sets the desired task count to zero and shuts down.

## Requirements
- AWS Account
- Domain name with DNS served from Route53
- Minecraft Java edition (though it could be tweaked to work with bedrock)
- Use of the excellent [Minecraft Docker] server image (used within task definition, no direct download required)

## Cost Breakdown
- Link to [AWS Estimate] assuming 20 hours a month usage.
- tl;dr : $0.50 per month for DNS zones, $0.0149 (one point five cents) per hour for Fargate Spot or $0.049 (four point nine cents) per hour for regular Fargate.  All other costs negligible, a couple of pennies per month at most.

# Installation and Setup
One day, this could be a Cloudformation template.  Until then, these steps are required.

## Region Selection
While it doesn't matter which region you decide to run your server in, Route53 will only ship its logs to us-east-1, which in turns means that the lambda function also has to be in us-east-1.  This lambda function can fire off the server in another region without issue, as long as the destination region is specified within the lambda function code.  For the purposes of this documentation, I'm using us-west-2 to run my server.

## VPC
A VPC with Subnets must exist in order for Fargate tasks to launch and for EFS shares to be mounted.  A subnet should exist in each availability zone so that Fargate (and Fargate Spot, if used) can properly launch the tasks in an AZ with plenty of capacity.  A security group for our task is required but is easiest configured when setting up the Task Definition below.

## Elastic File System
EFS is where the world data and server properties are stored, and persists between runs of the minecraft server.  Connecting to EFS and making changes is only possible by mounting it to an Linux based EC2 instance or by SFTP via AWS Transfer.

## Elastic Container Registry
Create a new private repo for our watchdog in ECR, such as 'minecraft/mcwatchdog'.

## IAM
The IAM Console is where we configure the roles and policies required to give access to the Task running the Minecraft server and the Lambda Function used to start it.

### Role Generation
In the IAM console, create a new role.
Call it something useful, like ecs.task.minecraft-server.  Three policies must be linked to this role, but we are only ready to create the first one now.

### EFS Policy
The first policy we need to create will allow for read/write access to our new EFS drive.

## Elastic Container Service

### Cluster
Create a new "Networking Only" Cluster.  Call it Minecraft.  Don't create a dedicated VPC for this.  Enabling Container Insights is optional but recommended for troubleshooting later, especially if you expect a lot of people to potentially connect and you want to view CPU or Memory usage.

### Task Definition
Create a new Task Definition called minecraft-server.
- Task Role: ecs.task.minecraft-server (or whatever you called it when creating it above)
- Network Mode: awsvpc (default)
- Requires compatibilities: fargate (default)
- Task Execution Role: ecsTaskExecutionRole (default)
- Task Memory: 2GB (good to start, increase later if needed)
- Task CPU: 1 vCPU (good to start, increase later if needed)

Skip containers temporarily and go down to Volumes.  Add a volume, call it data, volume type EFS.  Select the filesystem id created above, root directory /minecraft and click Add.

Scroll back up and add a container.  Call it minecraft-server.
- Image: itzg/minecraft-server
- Port Mappings: 25565 TCP
- Essential: NOT Checked (task stops with the watchdog container)
- Environment Variables.
  - EULA: TRUE
  - Other from [Minecraft Docker Server Docs]
- Mount Points: data mounted to /data

Add a second container.  Call it mc-watchdog
- Image URI from ECR container uploaded above.
- Essential: YES checked
- Environmental Variables
  - CLUSTER: minecraft
  - SERVICE: minecraft-server
  - DNSZONE: Route53 hosted zone ID
  - SERVERNAME: minecraft.example.com
  - TWILIOFROM: +1XXXYYYZZZZ (optional, your twilio number)
  - TWILIOTO: +1XXXYYYZZZZ (optional, your cell phone to get a text on)
  - TWILIOAID: Twilio account ID (optional)
  - TWILIOAUTH: Twilio auth code (optional)

Create task.

### Service

## IAM ECS Policy

## Lambda

## Route 53
Ensure that a domain name you own is set up in Route 53.  Add an A record with a 30 second TTL with a unique name that you will use to connect to your minecraft server.  Something like minecraft.example.com, or more complex if desired, as every time anyone _in the world_ performs a DNS lookup on this name, your Minecraft server will launch.

## IAM Route53 Policy

## CloudWatch



##

  [Minecraft Docker]: <https://hub.docker.com/r/itzg/minecraft-server>
  [AWS Estimate]: <https://calculator.aws/#/estimate?id=61e8ef3440b68927eb0da116e18628e3081875b6>
  [Minecraft Docker Server Docs]: <https://github.com/itzg/docker-minecraft-server/blob/master/README.md>
