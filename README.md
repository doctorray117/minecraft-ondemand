# minecraft-ondemand
Almost free serverless on-demand Minecraft server in AWS

## Background
Instead of paying a minecraft hosting service for a private server for you and your friends, host it yourself.  By utilizing several AWS services, a minecraft server can automatically start when you're ready to use it, and shut down when you are done.  The final cost will depend on use but can be as little as a a dollar or two per month.  The cost estimate breakdown is below.

## Workflow
The process works as follows:
1. Open Minecraft Multiplayer, let it look for our server, it will fail.
2. The DNS lookup query is logged in Route53 on our public hosted zone.
3. CloudWatch forwards the query to Lambda.
4. Lambda modifies an ECS Fargate service to a desired task count of 1.
5. Fargate launches two containers, Minecraft and a watchdog.
6. The watchdog optionally sends a text message through Twilio when the server is ready.
7. Refresh Minecraft server list, server is ready to connect.
8. After 10 minutes without a connection or 20 minutes after the last client disconnects (customizable) the watchdog sets the desired task count to zero and shuts down.

## Requirements
- AWS Account
- Domain name with DNS served from Route53
- Minecraft Java edition (though it could be tweaked to work with bedrock)

## Cost Breakdown
- Link to [AWS Estimate] assuming 20 hours a month usage.
- tl;dr : $0.50 per month for DNS zones, $0.0149 (one point five cents) per hour for Fargate Spot or $0.049 (four point nine cents) per hour for regular Fargate.  All other costs negligible, a couple of pennies per month at most.







  [AWS Estimate]: <https://calculator.aws/#/estimate?id=61e8ef3440b68927eb0da116e18628e3081875b6>
