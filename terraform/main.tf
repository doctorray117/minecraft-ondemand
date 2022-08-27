terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.0"
    }
  }
}

provider "aws" {
  default_tags {
    tags = {
      App = "Minecraft"
    }
  }
}

provider "aws" {
  alias  = "us-east-1"
  region = "us-east-1"
  default_tags {
    tags = {
      App = "Minecraft"
    }
  }
}


module "networking" {
  source     = "./modules/networking"
  region     = var.aws-region
  domain     = var.dns-domain
  servername = var.servername
  cw-lg      = module.notify.cw-lg
}

module "storage" {
  source   = "./modules/storage"
  vpc-id   = module.networking.vpc-id
  sn-ids   = module.networking.sn-ids
  sn-cidrs = module.networking.sn-cidrs
  region   = var.aws-region
}

module "compute" {
  source      = "./modules/compute"
  vpc-id      = module.networking.vpc-id
  sn-ids      = module.networking.sn-ids
  region      = var.aws-region
  fs-id       = module.storage.fs-id
  fsap-id     = module.storage.fsap-id
  sns-topic   = module.notify.sns-topic
  dns-domain  = var.dns-domain
  servername  = var.servername
  cw-lg       = module.notify.cw-lg
  r53-zone-id = module.networking.r53-zone-id
}

module "notify" {
  providers = {
    aws.east1 = aws.us-east-1
  }
  source     = "./modules/notify"
  dns-domain = var.dns-domain
  servername = var.servername
  lambda     = module.compute.lambda
}