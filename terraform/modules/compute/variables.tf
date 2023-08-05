variable "vpc-id" {
  type = string
}

variable "sn-ids" {
  type = map(string)
}

variable "region" {
  type = string
}

variable "fs-id" {
  type = string
}

variable "fsap-id" {
  type = string
}

variable "sns-topic" {
  type = string
}

variable "dns-domain" {
  type = string
}

variable "servername" {
  type = string
}

variable "cw-lg" {
  type = string
}

variable "r53-zone-id" {
  type = string
}