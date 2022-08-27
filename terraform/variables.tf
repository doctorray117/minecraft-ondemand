variable "aws-region" {
  type        = string
  description = "Your aws region, ex: us-east-1"
}

variable "dns-domain" {
  type        = string
  description = "Your public route53 domain, ex: example.com"
}

variable "servername" {
  type        = string
  description = "Your server name here, ex: mc"
}