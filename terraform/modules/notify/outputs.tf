output "cw-lg" {
  value = aws_cloudwatch_log_group.mc.arn
}

output "sns-topic" {
  value = aws_sns_topic.mc.arn
}