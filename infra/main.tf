terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.0"
    }
  }

  # Estado en S3 (mismo bucket que antes, clave distinta para no mezclarlo con la Lambda anterior).
  backend "s3" {
    bucket       = "tfstate-664342886904-eu-north-1"
    key          = "usuarios/terraform.tfstate"
    region       = "eu-north-1"
    encrypt      = true
    use_lockfile = true
  }
}

provider "aws" {
  region = "eu-north-1"
}
