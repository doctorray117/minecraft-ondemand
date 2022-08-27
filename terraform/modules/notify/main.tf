terraform {
  required_providers {
    aws = {
      source                = "hashicorp/aws"
      version               = "~> 4.0"
      configuration_aliases = [aws.east1]
    }
  }
}


data "aws_iam_policy_document" "mc" {
  statement {
    actions = [
      "logs:CreateLogStream",
      "logs:PutLogEvents",
    ]

    resources = ["arn:aws:logs:*:*:log-group:/aws/route53/*"]

    principals {
      identifiers = ["route53.amazonaws.com"]
      type        = "Service"
    }
  }
}

resource "aws_cloudwatch_log_subscription_filter" "mc" {
  name            = "minecraft"
  log_group_name  = aws_cloudwatch_log_group.mc.name
  filter_pattern  = "${var.servername}.${var.dns-domain}"
  destination_arn = var.lambda
}

resource "aws_cloudwatch_log_resource_policy" "mc" {
  policy_document = data.aws_iam_policy_document.mc.json
  policy_name     = "mc-r53-policy"
}

resource "aws_cloudwatch_log_group" "mc" {
  name              = "/aws/route53/${var.dns-domain}"
  retention_in_days = 7
}

resource "aws_sns_topic" "mc" {
  name              = "minecraft-notifications"
  kms_master_key_id = "alias/aws/sns"
}