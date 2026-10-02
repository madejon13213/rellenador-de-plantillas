# 1. Terraform y el "provider": el plugin que sabe hablar con AWS.
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = "eu-north-1"
}

# 2. Empaqueta lambda_function.py en un zip (lo que hiciste con Compress-Archive).
data "archive_file" "zip" {
  type        = "zip"
  source_file = "${path.module}/lambda_function.py"
  output_path = "${path.module}/function.zip"
}

# 3. El rol de IAM: quién puede "ser" el Lambda (lo que hiciste con create-role).
resource "aws_iam_role" "lambda_rol" {
  name = "hola-lambda-tf-rol"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

# 4. Permiso para escribir logs en CloudWatch.
resource "aws_iam_role_policy_attachment" "logs" {
  role       = aws_iam_role.lambda_rol.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# 5. La función Lambda en sí (lo que hiciste con create-function).
resource "aws_lambda_function" "hola" {
  function_name    = "hola-mundo-tf"
  runtime          = "python3.12"
  handler          = "lambda_function.lambda_handler"
  role             = aws_iam_role.lambda_rol.arn
  filename         = data.archive_file.zip.output_path
  source_code_hash = data.archive_file.zip.output_base64sha256
}

# 6. Muestra el nombre al terminar.
output "nombre_lambda" {
  value = aws_lambda_function.hola.function_name
}
