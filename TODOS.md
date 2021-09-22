# TODOs

## Functionality

- [x] Add CloudWatch trigger for the lambda
- [x] Integrate delegate zone setup
- [x] SNS/Twilio integration

## Bugs

- [x] Sort out task permissions errors
- [x] Investigate 3x event creation on lambda
- [x] Update retention settings for resources not removed by `cdk destroy`

## Customization

- [ ] Parameterize additional settings
- [x] Add .env for configs
- [ ] Optional resource creation/existing resource reuse

## Housekeeping

- [x] Swap out subs with Arn.format
- [ ] Add description fields on resources
- [ ] Modularize components
- [ ] Additional docstrings
- [ ] Create documentation
- [x] Add "requireApproval": "never" to cdk.json

## Enhancements

- [x] Add handler for users not running docker
- [ ] Add optional billing alert
- [ ] EFS -> S3 DataSync
- [ ] Integration testing
- [x] Add additional configs for [Minecraft Docker Server Docs](https://github.com/itzg/docker-minecraft-server/blob/master/README.md)
- [ ] Adjust [connection monitoring](https://github.com/doctorray117/minecraft-ondemand/issues/11) alternatives to incorporate bedrock support
