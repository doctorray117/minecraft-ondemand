# TODOs

## Functionality

- [x] Add CloudWatch trigger for the lambda
- [x] Integrate delegate zone setup
- [ ] SNS/Twilio integration

## Bugs

- [x] Sort out task permissions errors
- [x] Investigate 3x event creation on lambda
- [x] Update retention settings for resources not removed by `cdk destroy`

## Customization

- [ ] Parameterize additional settings
- [ ] Add .env for configs
- [ ] Optional resource creation/existing resource reuse

## Housekeeping

- [ ] Swap out subs with Arn.format
- [ ] Add description fields on resources
- [ ] Modularize components
- [ ] Additional docstrings
- [ ] Create documentation
- [x] Add "requireApproval": "never" to cdk.json

## Enhancements

- [ ] Add optional billing alert
- [ ] EFS -> S3 DataSync
- [ ] Integration testing
