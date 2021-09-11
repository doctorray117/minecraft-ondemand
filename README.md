# minecraft-ondemand
Almost free serverless on-demand Minecraft server in AWS

## Background
Instead of paying a minecraft hosting service for a private server for you and your friends, host it yourself.  By utilizing several AWS services, a minecraft server can automatically start when you're ready to use it, and shut down when you are done.  The final cost will depend on use but can be as little as a a dollar or two per month.  The cost estimate breakdown is below.

This is a _reasonably_ cost effective solution for someone that doesn't need their server running 24/7.  If that's you, read on!

## Workflow
The process works as follows:
1. Open Minecraft Multiplayer, let it look for our server, it will time out.
2. The DNS lookup query is logged in Route 53 on our public hosted zone.
3. CloudWatch forwards the query to a Lambda function.
4. The Lambda function modifies an existing ECS Fargate service to a desired task count of 1.
5. Fargate launches two containers, Minecraft and a watchdog, which updates the DNS record to the new IP
6. The watchdog optionally sends a text message through Twilio and/or publishes to an SNS topic when the server is ready.
7. Refresh Minecraft server list, server is ready to connect.
8. After 10 minutes without a connection or 20 minutes after the last client disconnects (customizable) the watchdog sets the desired task count to zero and shuts down.

## Diagram
![Basic Workflow](diagrams/aws_architecture.drawio.png)

## Requirements
- AWS Account
- Domain name with public DNS served from Route 53.  Does not need to be registered through Route 53.
- Minecraft Java edition client (though it could probably be tweaked to work with bedrock edition)
- Use of the excellent [Minecraft Docker] server image (used within task definition, no direct download required)

## Cost Breakdown
- Link to [AWS Estimate] assuming 20 hours a month usage.
- tl;dr : $0.50 per month for DNS zones, $0.0149 (one point five cents) per hour for Fargate Spot or $0.049 (four point nine cents) per hour for regular Fargate.  All other costs negligible, a couple of pennies per month at most.
- tl;dr;tl;dt : $1.50 / month for 20 hours of play.

# Installation and Setup
A Cloud Deployment Kit (CDK) implementation is in progress.  What follows is a manual walkthrough.

## Checklist of things to keep track of
To simplify the procedure, your ECS cluster name, service name, and sns topic name need to be defined before you start.  This is because we will be referencing them before they are created.  In the documentation I use these:
- Cluster name : `minecraft`
- Service name : `minecraft-server`
- SNS Topic : `minecraft-notifications`

Things you need to go find because they'll be used in the procedure are:
- AWS Account ID.  This is a 12 digit number (at least mine is).  [Finding your AWS account ID].  Put this in the IAM policies where I've put `zzzzzzzzzzzz`
- Hosted Zone ID.  This is a variable length string tied to your domain name in the Route 53 console.

Things you will locate as you go along and will need during IAM policy creation:
- EFS File System ID
- EFS Access Point ID

## Region Selection
While it doesn't matter which region you decide to run your server in, **Route 53 will only ship its logs to us-east-1**, which in turns means that the lambda function also has to be in us-east-1.  This lambda function can fire off the server in another region without issue, as long as the destination region is specified within the lambda function code.  For the purposes of this documentation, I'm using `us-west-2` to run my server.

Double check the region in anything you're copy/pasting.

## VPC
A VPC with Subnets must exist in order for Fargate tasks to launch and for EFS shares to be mounted.  A subnet should exist in each availability zone so that Fargate (and Fargate Spot, if used) can properly launch the tasks in an AZ with plenty of capacity.  A security group for our task is required but is easiest configured when setting up the Task Definition below.

A [Default VPC] should do the trick, chances are you've already got one.

## Elastic File System
EFS is where the world data and server properties are stored, and persists between runs of the minecraft server.  By using an "Access Point" the mounted folder is created automatically, so no mounting of the EFS to an external resource is required to get up and running.  To make changes to the files like `server.properties` later however, a user can either mount the EFS file system to a Linux host in their account if they're comfortable with that, or I detail another method below using AWS DataSync and S3 that anyone can use without Linux experience.

### Creating the EFS
Open the Elastic File System console and create a new file system.  Believe it or not, all the defaults are fine here!  It will create an EFS available in each subnet within your VPC.

Select your newly created filesystem, and tap the `Access Points` tab.  Create a new access point using the following specifics:
- Details
  - Root directory path : `/minecraft`
- POSIX User
  - User ID : `1000`
  - Group ID : `1000`
- Root directory creation permissions (this is required, otherwise our container won't be able to create the folder to store its data the first time)
  - Owner user ID : `1000`
  - Owner group IP : `1000`
  - POSIX Permissions : `0755`

Click `Create access point`.  Record the File System ID and the Access Point ID for our checklist.  They are in the format `fs-xxxxxxxx` and `fsap-xxxxxxxxxxxxxxxxx` respectively.

## Lambda
A lambda function must exist that turns on your minecraft service.  We do this with a simple python function that change the "Tasks Desired" count from zero to one when it is invoked.  We haven't created the ECS service yet, but that's okay, because we decided on the cluster name and service name before we started.

Because we are relying on Route 53+CloudWatch to invoke the Lambda function, it *must* reside in the N. Virginia (us-east-1) region.

From the Lambda console, create a new function using `Author from scratch`.  I've used Python 3.9 but the latest version available should be fine.  Call it `minecraft-launcher`.  The other defaults are fine, it will create an IAM role we will modify afterward.  We do not need to specify a VPC.

Once the function has been created and you're in the code editor, replace the contents of the default lambda_function.py with this:
```python
import boto3

REGION = 'us-west-2'
CLUSTER = 'minecraft'
SERVICE = 'minecraft-server'


def lambda_handler(event, context):
    """Updates the desired count for a service."""

    ecs = boto3.client('ecs', region_name=REGION)
    response = ecs.describe_services(
        cluster=CLUSTER,
        services=[SERVICE],
    )

    desired = response["services"][0]["desiredCount"]

    if desired == 0:
        ecs.update_service(
            cluster=CLUSTER,
            service=SERVICE,
            desiredCount=1,
        )
        print("Updated desiredCount to 1")
    else:
        print("desiredCount already at 1")
```
This file is also in this repository in the `lambda` folder.  Change the region, cluster, or service on lines 3-5 if needed.  Then, click the `Deploy` button.  Switch back to your server region now so that we don't create anything in the wrong region later.

Lambda can be very inexpensive when used sparingly.  For example, this lambda function runs in about 1600ms when starting the container, and in about 500ms if the container is already online.  This means, running at a 128MB memory allocation, it will cost $0.00000336 the first time the server is launched from an off state, and about $0.00000105 every time someone connects to an online server, because anyone connecting will have to perform a DNS lookup which will trigger your lambda function.  If you and four friends played once a day for a month, it would come out to $0.0002583, which is 2.6% of a single penny.

## Route 53
Ensure that a domain name you own is set up in Route 53.  If you don't own one, consider registering one.  You can use Route 53 for convenience or go to one of the big domain providers.  Either way, ensure you've got your nameservers set to host out of Route 53 as it's required for the on-demand functionality.

### Server DNS Record
Add an A record with a 30 second TTL with a unique name that you will use to connect to your minecraft server.  Something like minecraft.yourdomainname.com, or more complex if desired, as every time anyone _in the world_ performs a DNS lookup on this name, your Minecraft server will launch.  The value of the record is irrelevant because it will be updated every time our container launches.  Use 1.1.1.1 or 192.168.1.1 for now if you can't think of anything.  The low TTL is so that the DNS clients and non-authoritative DNS servers won't cache the record long and you can connect quicker after the IP updates.

### Query Logging
The magic that allows the on-demand idea to work without any "always on" infrastructure comes in here, with Query logging.  Every time someone looks up a DNS record for your domain, it will hit Route 53 as the authoritative DNS server.  These queries can be logged and actions performed from them.

From your hosted zone, click `Configure query logging` on the top right.  Then, click `Grant Permission` so that it will apply appropriate policies for queries to be logged.  Finally, in `Log group` select `Create log group` and use the suggested name with your domain name in the string, `/aws/route53/yourdomainname.com` and click `Create`.

## Optional SNS Notifications
You can receive a text or email or anything else you want to consume via Amazon SNS, if Twilio isn't your thing.  This also allows this to be a 100% AWS solution.

From the SNS console, create a `Standard` topic called `minecraft-notifications`.  Also at your convenience, create a Subscription to the topic to a destination of your choice.  Email is easy and free, SMS is beyond the scope of this documentation but there's plenty of resources out there to help you set it up.

## IAM
The IAM Console is where we configure the roles and policies required to give access to the Task running the Minecraft server and the Lambda Function used to start it.

We will be creating four distinct policies and one role.  The policies will then be attached to the appropriate roles.

### Policies

#### EFS Policy
This policy will allow for read/write access to our new Elastic File System Access Point.  In the policy below, replace the zzz's with your account id and put your file system and access point id in the appropriate places.  Change the region if necessary.

Call this policy `efs.rw.minecraft-data`
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "elasticfilesystem:ClientMount",
                "elasticfilesystem:ClientWrite",
                "elasticfilesystem:DescribeFileSystems"
            ],
            "Resource": "arn:aws:elasticfilesystem:us-west-2:zzzzzzzzzzzz:file-system/fs-xxxxxxxx",
            "Condition": {
                "StringEquals": {
                    "elasticfilesystem:AccessPointArn": "arn:aws:elasticfilesystem:us-west-2:zzzzzzzzzzzz:access-point/fsap-xxxxxxxxxxxxxxxxx"
                }
            }
        }
    ]
}
```

#### ECS Policy
This policy will allow for management of the Elastic Container Service tasks and service.  This lets the Lambda function start the service, as well as allows the service to turn itself off when not in use.  The `ec2:DescribeNetworkInterfaces` section is so that the task can determine what IP address is assigned to it to properly update the DNS record.

Replace the `zzzzzzzzzzzz` below with the appriopriate account ID in your ARN.  If you are not using the default cluster name or service name we decided above, change those as well.  Change the region if necessary.

Call this policy `ecs.rw.minecraft-service`
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "ecs:*"
            ],
            "Resource": [
                "arn:aws:ecs:us-west-2:zzzzzzzzzzzz:service/minecraft/minecraft-server",
                "arn:aws:ecs:us-west-2:zzzzzzzzzzzz:task/minecraft/*"
            ]
        },
        {
            "Effect": "Allow",
            "Action": [
                "ec2:DescribeNetworkInterfaces"
            ],
            "Resource": [
                "*"
            ]
        }
    ]
}
```

#### Route 53 Policy
This policy gives permission to our ECS task to update the DNS `A` record associated with our minecraft server.  Note: This will give your container access to change _all_ records within the hosted zone, and this may not be desirable if you're using this domain for anything else outside of this purpose.  If you'd like to increase security, you can create a subdomain zone of the main domain to limit the impact.  This is an advanced use case and the setup is described pretty well within the answers to [Delegate Zone Setup].

Place the hosted zone identifier from our checklist and place it in the Resource line within this policy where the XXX's are.

Call this policy `route53.rw.yourdomainname`
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "route53:GetHostedZone",
                "route53:ChangeResourceRecordSets",
                "route53:ListResourceRecordSets"
            ],
            "Resource": "arn:aws:route53:::hostedzone/XXXXXXXXXXXXXXXXXXXXX"
        },
        {
            "Effect": "Allow",
            "Action": [
                "route53:ListHostedZones"
            ],
            "Resource": "*"
        }
    ]
}
```

#### SNS policy (optional)
If you have decided to receive SNS notifications, we need a policy that allows publishing to the SNS topic you created.

Replace the zzz's with your account ID, and adjust the topic name or the region if you used something different.

Call this policy `sns.publish.minecraft-notifications`
```json
{ 
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": "sns:Publish",
            "Resource": "arn:aws:sns:us-west-2:zzzzzzzzzzzz:minecraft-notifications"
        }
    ]
}
```

### Roles
Policies are assigned to roles, and roles are used by services to services to perform the required tasks.  We are creating one new role and adjusting an existing role.

#### ECS Role
In the IAM console, select `Roles` and `Create role`.  In the wizard, in the first "Choose your use case" dialog click `Elastic Container Service` and then for "Select your use case", click `Elastic Container Service Task` (last one in the list).  Click `Next: Permissions`.

In the policy list, you can click `Filter policies` and select `Customer managed` to make this easier.  Check the boxes for all of our created policies:
- `efs.rw.minecraft-data`
- `ecs.rw.minecraft-service`
- `route53.rw.yourdomainname`
- `sns.publish.minecraft-notifications`

Click `Next: Tags` then `Next: Review`.  Call the role `ecs.task.minecraft-server` and click `Create role`.

#### Lambda Role
In the roles list, find the role created by the lambda function earlier.  It will be called `minecraft-launcher-role-xxxxxxxx`.  Click on it, then click `Attach policies`.  Give it the `ecs.rw.minecraft-service` policy we created earlier.

## Elastic Container Service
The final task we need to do is create the ECS task, cluster, and service.

### Task Definition
Create a new Task Definition called of `FARGATE` launch type.  In the configuration wizard, use these options:
- Task Definition Name: `minecraft-server`
- Task Role: `ecs.task.minecraft-server`
- Network Mode: `awsvpc` (default)
- Task Execution Role: `ecsTaskExecutionRole` (default)
- Task Memory: `2GB` (good to start, increase later if needed)
- Task CPU: `1 vCPU` (good to start, increase later if needed)

Skip `Container Definitions` temporarily and scroll further down to Volumes.  Click `Add volume`, call it `data`, volume type EFS.  Select the filesystem id from the dropdown that we created above, the access point id we created above, and check the box for `Encryption in transit` and click Add.

Scroll back up and click `Add container`.  Use defaults except for these specifics:
- Container name: `minecraft-server` 
- Image: `itzg/minecraft-server`
- Port Mappings: `25565 TCP`

Under `Advanced container configuration` make these changes:
- Environment
  - UNCHECK `Essential` (the watchdog container handles shutdowns)
  - Environment Variables.  One gotcha,  you have to select "Value" from the drop down list when defining these.
    - `EULA` : `TRUE`
    - Any additional stuff you want from [Minecraft Docker Server Docs]
- Storage and Logging
  - Mount Points
    - Source volume : `data`
    - Container path: `/data`

Click `Add` and then click `Add container` again to add a second container to the list.  Use defaults except for these specifics:

- Container name: `minecraft-ecsfargate-watchdog`
- Image: `doctorray/minecraft-ecsfargate-watchdog` (source for this container within this project if you want to build/host it yourself)

Under `Advanced container configuration` make these changes:
- Essential: YES checked (default)
- Environmental Variables (required)
  - `CLUSTER` : `minecraft`
  - `SERVICE` : `minecraft-server`
  - `DNSZONE` : Route 53 hosted zone ID from your checklist
  - `SERVERNAME` : `minecraft.yourdomainname.com`
- Environmental Variables (optional)
  - `STARTUPMIN` : Number of minutes to wait for a connection after starting before terminating (default 10)
  - `SHUTDOWNMIN` : Number of minutes to wait after the last client disconnects before terminating (default 20)
  - `SNSTOPIC` : Full ARN of your SNS topic (if using SNS)
  - `TWILIOFROM` : `+1XXXYYYZZZZ` (your twilio number)
  - `TWILIOTO` : `+1XXXYYYZZZZ` (your cell phone to get a text on)
  - `TWILIOAID` : Twilio account ID
  - `TWILIOAUTH` : Twilio auth code

If using Twilio to alert you when the server is ready and when it turns off, all four twilio variables must be specified.  If publishing to an SNS topic, the `SNSTOPIC` variable must be specified.

Click `Add` and then `Create` to create the task.

### Cluster
Create a new "Networking Only" Cluster.  Call it `minecraft`.  Don't create a dedicated VPC for this, use the default or same one you already created your EFS in.  Enabling Container Insights is optional but recommended for troubleshooting later, especially if you expect a lot of people to potentially connect and you want to review CPU or Memory usage.

### Service
Within your `minecraft` cluster, create a new Service.  Click `Switch to capacity provider`.  Click `Add another provider` and now you've got a choice.  Tasks can launch under the `FARGATE` strategy, which currently will run about 5 cents per hour, or they can launch under `FARGATE_SPOT`, and cost 1.5 cents per hour.  While this is cheaper, technically AWS can terminate your instance at any time if they need the capacity.  The watchdog is designed to intercept this termination command and shut down safely, so it's fine to use Spot to save a few pennies, at the extremely low risk of game interruption.

Select your task definition and version created above.  Platform version can be `LATEST` or `1.4.0`.  Call the service name `minecraft-server` to match the policies and lambda function.  Number of tasks should be 0 (this will prevent it from running now before it is ready, and the other processes adjust it later on demand).  Everything else on this page is fine as default. Hit Next.

Select your VPC, and select all of the subnets individually, which will maximize your success of running Fargate Spot tasks.

For Security Group, click edit.  Let it create a new security group.  Change the default HTTP rule to `Custom TCP` and change the port to `25565` from `Anywhere`, which will allow anyone to connect to the server once it is online (they have to know the name of course!)  You could also restrict by known IP addresses but this is cumbersome to update regularly.  Tap save.

Ensure that "Auto-assign public IP" is `ENABLED` (this is default).  Tap `Next`, `Next`, and `Create Service`.

## CloudWatch
The final step to link everything together is to configure CloudWatch to start your server when you try to connect to it.

Open the CloudWatch console and change to the `us-east-1` region.  Go to `Logs` -> `Log groups` -> and find the `/aws/route53/yourdomainname.com` Log group that we created in the Route 53 Query Log Configuration.  Optionally, modify the retention period to delete the logs after a few days so they don't accumulate forever.

Go to the `Subscription filters` tab, click `Create` and then `Create Lambda subscription filter`.

In the `Create Lambda subscription filter` page, use the following values:
- Lambda Function : `minecraft-launcher` or whatever you called it.
- Log format : `Other`
- Subscription filter pattern: `"minecraft.yourdomainname.com"` (or just simply `minecraft` -- this is what it's looking for to fire off the lambda)
- Subscription filter name: `minecraft`

Click `Start streaming`.










# Usage and Customization
To use your new server, open Minecraft Multiplayer, add your new server, and join.  It will fail at first but then everything comes online and you can join your new world!  You may notice that you don't have many permissions or ability to customize a lot of things yet, so let's dig into how to edit the relevant files!

## Option 1: Mount EFS Directly
This option is the easiest for folks that are comfortable in the Linux command line, so I'm not going to step-by-step it.  But basically, launch an AWS Linux v2 AMI in EC2 with bare-minimum specs, log into it, mount the EFS Access Point, and use your favorite command line text editor to change around server.properties, the ops.json, whitelists, whatever, and then re-launch your server with the new configuration.

## Option 2: DataSync and S3
Since EFS doesn't have a convenient way to access the files outside of mounting a share to something within the VPC, we can utilize AWS DataSync to copy files in and out to a more convenient location.  These instructions will use S3 as there are countless S3 clients out there you can manage files, including the AWS Console itself.

### Step 1: Create an S3 bucket
Open the S3 console and create a bucket.  It must have a unique name (across ALL s3 buckets).  `yourdomainname-files` works pretty well.  Place it in the same region as your EFS share.  I always like to enable Bucket Versioning, in case you need to reference old files or restore to a different version.  Also enable Server Side Encryption (why isn't this on by default?).

### Step 2: Create an EFS -> S3 DataSync Task
Open the DataSync console and click `Create task`.

For `Source location options`, select `Create new location` with these options:
- Location type : `Amazon EFS file system`
- Region : The region your EFS is in
- EFS File System : The file system you created earlier (this is the file system itself not the access point)
- Mount path : `/minecraft` or wherever your Access Point is pointed to

Click `Next`.  For `Destination location options` select `Create new location` with these options:
- Location type : `Amazon S3`
- Region : The region your bucket was created in
- S3 bucket : The bucket you created earlier
- S3 storage class : `Standard` is fine, these are really small files.
- Folder : `/minecraft`
- IAM Role : Click `Autogenerate` and it will fill this in for you.

Click `Next`.  For `Task Name` consider something like `minecraft-efs-to-s3`.  For the rest of the options, use these:
- Task execution configuration : Use all defaults
- Data transfer configuration
  - Data to scan : Entire source location
  - Transfer mode : Transfer only data that has changed
  - Keep deleted files / Overwrite files : Keep enabled as default
  - Excludes : add three excludes:
    - `*.jar` (this prevents copying the minecraft server binary
    - `/world` (we definitely don't want to overwrite your world...)
    - `/logs` (we can go to cloudwatch to look at these anytime)
- Schedule : not scheduled, we'll run it on demand
- Task logging
  - Log level : Do not send logs to CloudWatch

Click `Next` and `Create task`.

### Step 3: Create an S3 -> EFS DataSync Task
Open the DataSync console and click `Create task`.

For `Source location options`, select `Choose an existing location` with these options:
- Region : The region your S3 bucket is in
- Existing locations : The S3 location you created in the previous step

Click `Next`.  For `Destination location options` select `Choose an existing location` with these options:
- Region : The region your EFS is in
- Existing locations: The EFS location you created in the previous step

Click `Next`.  For `Task Name` consider something like `minecraft-s3-to-efs`.  For the rest of the options, use these:
- Task execution configuration : Use all defaults
- Data transfer configuration
  - Data to scan : Entire source location
  - Transfer mode : Transfer only data that has changed
  - Keep deleted files / Overwrite files : Keep enabled as default
  - Excludes : None necessary this time around
- Schedule : not scheduled, we'll run it on demand
- Task logging
  - Log level : Do not send logs to CloudWatch

Click `Next` and `Create task`.

### Usage and file editing
After you've launched the minecraft server successfully once, it will create files in EFS such as `server.properties`, `ops.json`, `whitelist.json` among others.  From the DataSync console, you can launch the `minecraft-efs-to-s3` task, which will copy these files from the EFS share to your S3 bucket.  Then you can download these files from S3 (using the console or something like [S3 Browser]), edit them on your computer, then use the same client to upload the files back to S3.  Afterward, open DataSync and launch the `minecraft-s3-to-efs` task to copy the updated files back to your EFS share.  Then when you launch the server again, it will see and use the new files.

Best practice would be, any time you want to make a change to always copy the latest files from EFS to S3 first while your server is off before editing them and copying them back.  Otherwise you may unintentionally regress some settings.

# Testing and Troubleshooting
The easiest way to trigger your process is to perform a dns lookup, which you can simply do by trying to visit your server name in a web browser.  It will fail (duh) but it will also trigger your server to start up.

## Areas of concern, what to watch

### CloudWatch
Are your DNS queries getting logged properly?  Check in the log groups, hit refresh.  Often takes up to 30 seconds for them to show up.

### Lambda
Is your function running?  We didn't design a "test" functionality for it but you could!

### Elastic Container Service
Can you start your server manually by setting desired count to 1?  Here's some possible jumping off points for issues:

#### Service won't launch task
Check the execution roles, and that they have the right permissions.  Check the container names for typos.  Check that you selected multiple subnets in the task definition, and that it's using the LATEST version.  If you updated the task definition, did you update the Service to use the new task definition version?

#### Containers won't switch to RUNNING state
Check all of the above, but also ensure you're using an EFS Access Point with the specified auto-create permissions.  The minecraft container will fail if it can't mount the data volume.

### Can't connect to minecraft server
Refresh.  Wait a minute, especially the first launch.  Check ECS to see that the containers are in the RUNNING state.  Open the running task, go to the logs tab, select minecraft and see if there are any errors on the logs.  Did you make sure you opened the right port (25565 TCP) to the world in the task security group??  Security groups can be edited from both the VPC and the EC2 console.

### Not getting text messages
Are your Twilio vars valid?  Do you have sufficient funds on your Twilio account?  Check the logs on the watchdog container for any curl errors.

## Server starts randomly?
Remember, the server starts with a DNS query automatically.  So, if you've got buddies you've shared the server with, it may start up if they open their multiplayer screen to play on a different server if yours is in the list!  If this is an issue, it could probably be mitigated with a more advanced CloudWatch Subscription Filter that checks against the source IP address in addition to just the domain name, with it limiting to your ISP or location.

# Other Stuff

## Concerned about cost overruns?
Set up a [Billing Alert]!  You can get an email if your bill exceeds a certain amount.  Set it at $5 maybe?

## Twilio setup / usage
Open a free account at [Twilio], and load it up with $10 or so of credit.  You can purchase a phone number here for a small monthly fee, and pay per use text messaging.  Doing this will allow the container to send you a text message when the server is available for use.

## Suggestions, comments, concerns?
Open an issue, fork the repo, send me a pull request or a message.

  [Finding your AWS account ID]: <https://docs.aws.amazon.com/IAM/latest/UserGuide/console_account-alias.html#FindingYourAWSId>
  [Default VPC]: <https://docs.aws.amazon.com/vpc/latest/userguide/default-vpc.html>
  [Minecraft Docker]: <https://hub.docker.com/r/itzg/minecraft-server>
  [AWS Estimate]: <https://calculator.aws/#/estimate?id=61e8ef3440b68927eb0da116e18628e3081875b6>
  [Minecraft Docker Server Docs]: <https://github.com/itzg/docker-minecraft-server/blob/master/README.md>
  [Delegate Zone Setup]: <https://stackoverflow.com/questions/47527575/aws-policy-allow-update-specific-record-in-route53-hosted-zone>
  [Billing Alert]: <https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/monitor_estimated_charges_with_cloudwatch.html>
  [S3 Browser]: <https://s3browser.com>
  [Twilio]: <https://twilio.com>
  [Principle of least privilege]: <https://en.wikipedia.org/wiki/Principle_of_least_privilege>
