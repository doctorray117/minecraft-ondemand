data "aws_caller_identity" "current" {}

resource "aws_ecs_cluster" "mc" {
  name = "minecraft"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

resource "aws_ecs_task_definition" "mc" {
  requires_compatibilities = ["FARGATE"]
  family                   = "minecraft-server"
  cpu                      = 1024
  memory                   = 2048
  network_mode             = "awsvpc"
  task_role_arn            = aws_iam_role.mc-ecs.arn
  execution_role_arn       = aws_iam_role.mc-ecs-exec.arn
  container_definitions = jsonencode([
    {
      name      = "minecraft-server"
      image     = "itzg/minecraft-server"
      essential = false
      mountPoints = [
        {
          sourceVolume  = "data",
          containerPath = "/data"
        }
      ]
      environment = [
        {
          name  = "EULA"
          value = "true"
        }
      ]
      portMappings = [
        {
          containerPort = 25565
          hostPort      = 25565
        }
      ]
    },
    {
      name      = "minecraft-ecsfargate-watchdog"
      image     = "doctorray/minecraft-ecsfargate-watchdog"
      essential = true
      environment = [
        {
          name  = "CLUSTER"
          value = "minecraft"
          }, {
          name  = "SERVICE"
          value = "minecraft-server"
          }, {
          name  = "DNSZONE"
          value = var.r53-zone-id
          }, {
          name  = "SERVERNAME"
          value = "${var.servername}.${var.dns-domain}"
          }, {
          name  = "SNSTOPIC"
          value = var.sns-topic
        }
      ]
    }
  ])

  volume {
    name = "data"
    efs_volume_configuration {
      file_system_id     = var.fs-id
      transit_encryption = "ENABLED"
      authorization_config {
        access_point_id = var.fsap-id
        iam             = "ENABLED"
      }
    }
  }
}

resource "aws_ecs_service" "mc" {
  name            = "minecraft-server"
  cluster         = aws_ecs_cluster.mc.id
  task_definition = aws_ecs_task_definition.mc.arn
  desired_count   = 0

  capacity_provider_strategy {
    capacity_provider = "FARGATE"
    weight            = 1
  }

  network_configuration {
    subnets = [
      var.sn-ids["mc-sn-1"],
      var.sn-ids["mc-sn-2"],
    ]
    security_groups = [
      aws_security_group.mc.id,
    ]
    assign_public_ip = true
  }

  lifecycle {
    ignore_changes = [desired_count]
  }

}

resource "aws_security_group" "mc" {
  name        = "minecraft-ecs-sg"
  description = "Minecraft Server Inbound Traffic"
  vpc_id      = var.vpc-id

  ingress {
    description = "Minecraft Clients"
    from_port   = 25565
    to_port     = 25565
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "Allow All Outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "minecraft-ecs-sg"
  }
}

data "archive_file" "lambda-zip" {
  type        = "zip"
  output_path = "${path.module}/lambda_function_payload.zip"
  source {
    content  = <<EOF
import boto3

REGION = '${var.region}'
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
EOF
    filename = "lambda_function_payload.py"
  }
}

resource "aws_lambda_function" "mc" {
  filename      = data.archive_file.lambda-zip.output_path
  function_name = "minecraft-launcher"
  role          = aws_iam_role.mc-ld.arn
  runtime       = "python3.9"
  handler       = "lambda_function_payload.lambda_handler"
}

resource "aws_lambda_permission" "mc" {
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.mc.function_name
  principal     = "logs.${var.region}.amazonaws.com"
  source_arn    = "${var.cw-lg}:*"
}

resource "aws_cloudwatch_log_group" "mc" {
  name              = "/aws/lambda/${aws_lambda_function.mc.function_name}"
  retention_in_days = 7
}

data "aws_iam_policy_document" "mc-efs" {
  version = "2012-10-17"
  statement {
    actions = [
      "elasticfilesystem:ClientMount",
      "elasticfilesystem:ClientWrite",
      "elasticfilesystem:DescribeFileSystems"
    ]
    effect = "Allow"
    resources = [
      "arn:aws:elasticfilesystem:${var.region}:${data.aws_caller_identity.current.account_id}:file-system/${var.fs-id}"
    ]
    condition {
      test     = "StringLike"
      variable = "elasticfilesystem:AccessPointArn"
      values = [
        "arn:aws:elasticfilesystem:${var.region}:${data.aws_caller_identity.current.account_id}:access-point/${var.fsap-id}",
      ]
    }
  }
}

resource "aws_iam_policy" "mc-efs" {
  name        = "efs.rw.minecraft-data"
  path        = "/"
  description = "Minecraft to EFS Policy"
  policy      = data.aws_iam_policy_document.mc-efs.json
}

data "aws_iam_policy_document" "mc-ecs" {
  version = "2012-10-17"
  statement {
    actions = ["ecs:*"]
    effect  = "Allow"
    resources = [
      "arn:aws:ecs:${var.region}:${data.aws_caller_identity.current.account_id}:service/minecraft/minecraft-server",
      "arn:aws:ecs:${var.region}:${data.aws_caller_identity.current.account_id}:task/minecraft/*"
    ]
  }
  statement {
    actions   = ["ec2:DescribeNetworkInterfaces"]
    effect    = "Allow"
    resources = ["*"]
  }
}

resource "aws_iam_policy" "mc-ecs" {
  name        = "ecs.rw.minecraft-service"
  path        = "/"
  description = "Minecraft to ECS Policy"
  policy      = data.aws_iam_policy_document.mc-ecs.json
}

data "aws_iam_policy_document" "mc-r53" {
  version = "2012-10-17"
  statement {
    actions = [
      "route53:GetHostedZone",
      "route53:ChangeResourceRecordSets",
      "route53:ListResourceRecordSets",
    ]
    effect = "Allow"
    resources = [
      "arn:aws:route53:::hostedzone/${var.r53-zone-id}",
    ]
  }
  statement {
    actions   = ["route53:ListHostedZones"]
    effect    = "Allow"
    resources = ["*"]
  }
}

resource "aws_iam_policy" "mc-r53" {
  name        = "route53.rw.${var.dns-domain}"
  path        = "/"
  description = "Minecraft to Route53 Policy"
  policy      = data.aws_iam_policy_document.mc-r53.json
}

data "aws_iam_policy_document" "mc-sns" {
  version = "2012-10-17"
  statement {
    actions = ["sns:Publish"]
    effect  = "Allow"
    resources = [
      "arn:aws:sns:${var.region}:${data.aws_caller_identity.current.account_id}:${var.sns-topic}",
    ]
  }
}

resource "aws_iam_policy" "mc-sns" {
  name        = "sns.publish.minecraft-notifications"
  path        = "/"
  description = "Minecraft to SNS Policy"
  policy      = data.aws_iam_policy_document.mc-sns.json
}

resource "aws_iam_role" "mc-ld" {
  name = "mc-iam-lambda"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Sid    = ""
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      },
    ]
  })
}

resource "aws_iam_role_policy_attachment" "mc-ld" {
  role       = aws_iam_role.mc-ld.name
  policy_arn = aws_iam_policy.mc-ecs.arn
}

resource "aws_iam_role" "mc-ecs" {
  name = "ecs.task.minecraft-server"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Sid    = ""
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      },
    ]
  })
}

resource "aws_iam_role_policy_attachment" "mc-ecs" {
  role       = aws_iam_role.mc-ecs.name
  policy_arn = aws_iam_policy.mc-ecs.arn
}

resource "aws_iam_role_policy_attachment" "mc-efs" {
  role       = aws_iam_role.mc-ecs.name
  policy_arn = aws_iam_policy.mc-efs.arn
}

resource "aws_iam_role_policy_attachment" "mc-r53" {
  role       = aws_iam_role.mc-ecs.name
  policy_arn = aws_iam_policy.mc-r53.arn
}

resource "aws_iam_role_policy_attachment" "mc-sns" {
  role       = aws_iam_role.mc-ecs.name
  policy_arn = aws_iam_policy.mc-sns.arn
}

resource "aws_iam_role" "mc-ecs-exec" {
  name = "ecs.task.exec.minecraft-server"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Sid    = ""
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      },
    ]
  })
}

resource "aws_iam_role_policy_attachment" "mc-ecs-exec" {
  role       = aws_iam_role.mc-ecs-exec.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}