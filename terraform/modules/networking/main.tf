locals {
  subnets = {
    mc-sn-1 = {
      cidr = "10.200.50.128/26"
      az   = "${var.region}a"
    }
    mc-sn-2 = {
      cidr = "10.200.50.192/26"
      az   = "${var.region}b"
    }
  }
}


resource "aws_vpc" "mc" {
  cidr_block           = "10.200.50.128/25"
  enable_dns_hostnames = true

  tags = {
    Name = "mc-vpc"
  }
}

resource "aws_subnet" "mc" {
  for_each                = local.subnets
  vpc_id                  = aws_vpc.mc.id
  cidr_block              = each.value.cidr
  map_public_ip_on_launch = true
  availability_zone       = each.value.az

  tags = {
    Name = each.key
  }
}

resource "aws_internet_gateway" "mc" {
  vpc_id = aws_vpc.mc.id

  tags = {
    Name = "mc-igw"
  }
}

resource "aws_route_table" "mc" {
  vpc_id = aws_vpc.mc.id

  tags = {
    Name = "mc-rt"
  }
}

resource "aws_route" "mc" {
  route_table_id         = aws_route_table.mc.id
  destination_cidr_block = "0.0.0.0/0"
  gateway_id             = aws_internet_gateway.mc.id
}

resource "aws_route_table_association" "mc" {
  for_each       = local.subnets
  subnet_id      = aws_subnet.mc[each.key].id
  route_table_id = aws_route_table.mc.id
}

resource "aws_route53_zone" "mc" {
  name = var.domain
}

resource "aws_route53_record" "mc" {
  zone_id = aws_route53_zone.mc.zone_id
  name    = "${var.servername}.${var.domain}"
  type    = "A"
  ttl     = 30
  records = ["127.0.0.1"]
}

resource "aws_route53_query_log" "mc" {
  cloudwatch_log_group_arn = var.cw-lg
  zone_id                  = aws_route53_zone.mc.zone_id
}