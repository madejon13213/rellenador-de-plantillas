terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
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

# Tabla de usuarios. Cada usuario es un item identificado por user_id.
# El resto de atributos (nombre, apellidos, ...) se guardan sin declararlos aquí.
resource "aws_dynamodb_table" "usuarios" {
  name         = "usuarios"
  billing_mode = "PAY_PER_REQUEST" # pagas por uso; sin uso, coste ~0
  hash_key     = "user_id"

  attribute {
    name = "user_id"
    type = "S"
  }

  # Para buscar un usuario por email sin recorrer toda la tabla.
  attribute {
    name = "email"
    type = "S"
  }

  global_secondary_index {
    name            = "email-index"
    hash_key        = "email"
    projection_type = "ALL"
  }

  # Permite restaurar la tabla a cualquier punto de los últimos 35 días.
  point_in_time_recovery {
    enabled = true
  }
}

output "tabla_usuarios" {
  value = aws_dynamodb_table.usuarios.name
}

output "tabla_usuarios_arn" {
  value = aws_dynamodb_table.usuarios.arn
}
