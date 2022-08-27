output "vpc-id" {
  value = aws_vpc.mc.id
}

output "sn-ids" {
  value = {
    for k, v in aws_subnet.mc : k => v.id
  }
}

output "sn-cidrs" {
  value = {
    for k, v in aws_subnet.mc : k => v.cidr_block
  }
}

output "r53-zone-name" {
  value = aws_route53_zone.mc.name
}

output "r53-zone-id" {
  value = aws_route53_zone.mc.id
}