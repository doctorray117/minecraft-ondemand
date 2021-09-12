# TODOs

## Functionality

- [x] Add CloudWatch trigger for the lambda
- [ ] SNS/Twilio integration
- [ ] Integrate delegate zone setup

## Bugs

- [x] Sort out task permissions errors
- [ ] Investigate 3x event creation on lambda
- [ ] Update retention settings for resources not removed by `cdk destroy`

## Customization

- [ ] Parameterize additional settings
- [ ] Add .env for configs
- [ ] Optional resource creation

## Housekeeping

- [ ] Swap out subs with Arn.format
- [ ] Add description fields on resources
- [ ] Modularize components
- [ ] Additional docstrings
- [ ] Create documentation
- [ ] Add "requireApproval": "never" to cdk.json

## Enhancements

- [ ] Add optional billing alert
- [ ] EFS -> S3 DataSync
- [ ] Integration testing

