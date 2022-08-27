data "aws_caller_identity" "current" {}

resource "aws_efs_file_system" "mc" {
  encrypted = true

  tags = {
    Name = "minecraft-efs"
  }
}

resource "aws_efs_mount_target" "mc" {
  for_each       = var.sn-ids
  file_system_id = aws_efs_file_system.mc.id
  subnet_id      = each.value

  security_groups = [
    aws_security_group.mc.id
  ]

}

resource "aws_efs_access_point" "mc" {
  file_system_id = aws_efs_file_system.mc.id

  root_directory {
    path = "/minecraft"
    creation_info {
      owner_uid   = "1000"
      owner_gid   = "1000"
      permissions = "0755"
    }
  }

  posix_user {
    gid = "1000"
    uid = "1000"
  }

  tags = {
    Name = "minecraft-efsap"
  }
}

resource "aws_security_group" "mc" {
  name        = "minecraft-efs-sg"
  description = "Allow inbound NFS traffic"
  vpc_id      = var.vpc-id

  ingress {
    description = "NFS from ECS"
    from_port   = 2049
    to_port     = 2049
    protocol    = "tcp"
    cidr_blocks = [
      var.sn-cidrs["mc-sn-1"],
      var.sn-cidrs["mc-sn-2"],
    ]
  }

  tags = {
    Name = "minecraft-efs-sg"
  }
}