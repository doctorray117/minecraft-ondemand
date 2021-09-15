# Minecraft ECS Fargate Watchdog
This document is a work in progress but is meant to document the container, its changes, and testing methods

## Changelog
- 1.2.0 - added support for bedrock edition with auto server type detection
- 1.1.0 - switched base image to amazon/aws-cli, added sigterm logging
- 1.0.3 - added optional sns topic env variable to send server notifications to
- 1.0.2 - fixed typo in shutdown timeout variable
- 1.0.1 - added text message when shutting down containers for any reason
- 1.0.0 - initial release

## Tests
With any changes, the container needs to be able to do the following without error:
- Detect minecraft edition either Java or Bedrock
- Automatically shut down after 10 minutes without a connection
- Detect a connection and not shut down
- Detect when all players have disconnected and initiate shutdown timer
- Shut down 20 minutes after last player has disconncted
- Catch SIGTERM and properly shut down

All of these tests should be performed on Java and Bedrock servers before pushing the `latest` tag.
