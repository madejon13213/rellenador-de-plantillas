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

# 2. Empaqueta backend/build (código + plantillas + dependencias) en un zip.
#    backend/build lo genera backend/build.sh antes de ejecutar Terraform.
data "archive_file" "zip" {
  type        = "zip"
  source_dir  = "${path.module}/../backend/build"
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
  timeout          = 15
  memory_size      = 256
}

# 6. API Gateway (HTTP API): la URL pública que llama a la Lambda.
resource "aws_apigatewayv2_api" "api" {
  name          = "hola-api-tf"
  protocol_type = "HTTP"

  # Permite que la web (Next.js) llame a la API desde el navegador.
  # Cuando publiques el frontend, añade aquí su dominio.
  cors_configuration {
    allow_origins  = ["http://localhost:3000"]
    allow_methods  = ["POST", "OPTIONS"]
    allow_headers  = ["content-type"]
    expose_headers = ["content-disposition"]
  }
}

resource "aws_apigatewayv2_integration" "lambda" {
  api_id                 = aws_apigatewayv2_api.api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.hola.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "post_generar" {
  api_id    = aws_apigatewayv2_api.api.id
  route_key = "POST /generar"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

# Stage $default con despliegue automático: cada cambio de ruta se publica solo.
resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.api.id
  name        = "$default"
  auto_deploy = true
}

# Permiso para que API Gateway pueda invocar la Lambda.
resource "aws_lambda_permission" "apigw" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.hola.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.api.execution_arn}/*/*"
}

# 7. Muestra el nombre y la URL al terminar.
output "nombre_lambda" {
  value = aws_lambda_function.hola.function_name
}

output "url_api" {
  value = "${aws_apigatewayv2_api.api.api_endpoint}/generar"
}
