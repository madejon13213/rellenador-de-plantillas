# Lambda "plantillas": subir, listar, consultar y borrar plantillas .docx.
# El archivo va a S3 y sus datos (nombre, campos detectados...) a DynamoDB.
data "aws_caller_identity" "actual" {}

locals {
  bucket_plantillas = "plantillas-${data.aws_caller_identity.actual.account_id}-eu-north-1"
}

resource "aws_dynamodb_table" "plantillas" {
  name         = "plantillas"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "plantilla_id"

  attribute {
    name = "plantilla_id"
    type = "S"
  }

  point_in_time_recovery {
    enabled = true
  }
}

# Bucket privado: los archivos solo los lee y escribe la Lambda.
resource "aws_s3_bucket" "plantillas" {
  bucket = local.bucket_plantillas
}

resource "aws_s3_bucket_public_access_block" "plantillas" {
  bucket                  = aws_s3_bucket.plantillas.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "plantillas" {
  bucket = aws_s3_bucket.plantillas.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

data "archive_file" "plantillas" {
  type        = "zip"
  source_dir  = "${path.module}/../backend/plantillas"
  output_path = "${path.module}/plantillas.zip"
  excludes    = ["__pycache__"]
}

resource "aws_iam_role" "plantillas" {
  name = "plantillas-lambda-rol"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "plantillas_logs" {
  role       = aws_iam_role.plantillas.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Solo su tabla y solo los archivos de su bucket.
resource "aws_iam_role_policy" "plantillas_acceso" {
  name = "acceso-plantillas"
  role = aws_iam_role.plantillas.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:DeleteItem",
          "dynamodb:Scan",
        ]
        Resource = aws_dynamodb_table.plantillas.arn
      },
      {
        Effect   = "Allow"
        Action   = ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"]
        Resource = "${aws_s3_bucket.plantillas.arn}/*"
      },
    ]
  })
}

resource "aws_lambda_function" "plantillas" {
  function_name    = "plantillas-api"
  runtime          = "python3.12"
  handler          = "lambda_function.lambda_handler"
  role             = aws_iam_role.plantillas.arn
  filename         = data.archive_file.plantillas.output_path
  source_code_hash = data.archive_file.plantillas.output_base64sha256
  timeout          = 15

  environment {
    variables = {
      TABLA_PLANTILLAS  = aws_dynamodb_table.plantillas.name
      BUCKET_PLANTILLAS = aws_s3_bucket.plantillas.bucket
    }
  }
}

output "bucket_plantillas" {
  value = aws_s3_bucket.plantillas.bucket
}
