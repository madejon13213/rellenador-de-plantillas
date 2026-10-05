# Lambda "documentos": genera un documento rellenando una plantilla con los datos de un usuario.
# Guarda el resultado en S3, deja constancia en DynamoDB y devuelve una URL temporal de descarga.
locals {
  bucket_documentos = "documentos-${data.aws_caller_identity.actual.account_id}-eu-north-1"
}

resource "aws_dynamodb_table" "documentos" {
  name         = "documentos"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "documento_id"

  attribute {
    name = "documento_id"
    type = "S"
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

  point_in_time_recovery {
    enabled = true
  }
}

resource "aws_s3_bucket" "documentos" {
  bucket = local.bucket_documentos
}

resource "aws_s3_bucket_public_access_block" "documentos" {
  bucket                  = aws_s3_bucket.documentos.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "documentos" {
  bucket = aws_s3_bucket.documentos.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# backend/build/documentos lo genera backend/build.sh (código + dependencias) antes de Terraform.
data "archive_file" "documentos" {
  type        = "zip"
  source_dir  = "${path.module}/../backend/build/documentos"
  output_path = "${path.module}/documentos.zip"
}

resource "aws_iam_role" "documentos" {
  name = "documentos-lambda-rol"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "documentos_logs" {
  role       = aws_iam_role.documentos.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Lee usuarios y plantillas, y escribe solo en su tabla y su bucket.
resource "aws_iam_role_policy" "documentos_acceso" {
  name = "acceso-documentos"
  role = aws_iam_role.documentos.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = "dynamodb:GetItem"
        Resource = [
          aws_dynamodb_table.usuarios.arn,
          aws_dynamodb_table.plantillas.arn,
        ]
      },
      {
        Effect   = "Allow"
        Action = ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:Query"]
        Resource = [
          aws_dynamodb_table.documentos.arn,
          "${aws_dynamodb_table.documentos.arn}/index/*",
        ]
      },
      {
        Effect   = "Allow"
        Action   = "s3:GetObject"
        Resource = "${aws_s3_bucket.plantillas.arn}/*"
      },
      {
        Effect   = "Allow"
        Action   = ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"]
        Resource = "${aws_s3_bucket.documentos.arn}/*"
      },
    ]
  })
}

resource "aws_lambda_function" "documentos" {
  function_name    = "documentos-api"
  runtime          = "python3.12"
  handler          = "lambda_function.lambda_handler"
  role             = aws_iam_role.documentos.arn
  filename         = data.archive_file.documentos.output_path
  source_code_hash = data.archive_file.documentos.output_base64sha256
  timeout          = 30
  memory_size      = 512

  environment {
    variables = {
      TABLA_USUARIOS    = aws_dynamodb_table.usuarios.name
      TABLA_PLANTILLAS  = aws_dynamodb_table.plantillas.name
      TABLA_DOCUMENTOS  = aws_dynamodb_table.documentos.name
      BUCKET_PLANTILLAS = aws_s3_bucket.plantillas.bucket
      BUCKET_DOCUMENTOS = aws_s3_bucket.documentos.bucket
    }
  }
}

output "bucket_documentos" {
  value = aws_s3_bucket.documentos.bucket
}
