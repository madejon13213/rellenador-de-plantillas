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

  # Cada dato pertenece a la cuenta que lo creó. El índice permite listar solo los suyos.
  attribute {
    name = "owner_id"
    type = "S"
  }

  attribute {
    name = "created_at"
    type = "S"
  }

  global_secondary_index {
    name            = "owner-index"
    hash_key        = "owner_id"
    range_key       = "created_at"
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
