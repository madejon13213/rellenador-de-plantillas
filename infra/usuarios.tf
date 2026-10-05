# Lambda "usuarios": CRUD de usuarios sobre la tabla de DynamoDB.
# Sin dependencias externas (boto3 ya viene en el runtime), así que se empaqueta la carpeta tal cual.
data "archive_file" "usuarios" {
  type        = "zip"
  source_dir  = "${path.module}/../backend/usuarios"
  output_path = "${path.module}/usuarios.zip"
  excludes    = ["__pycache__"]
}

resource "aws_iam_role" "usuarios" {
  name = "usuarios-lambda-rol"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

# Logs en CloudWatch.
resource "aws_iam_role_policy_attachment" "usuarios_logs" {
  role       = aws_iam_role.usuarios.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Solo las operaciones que necesita, y solo sobre la tabla de usuarios.
resource "aws_iam_role_policy" "usuarios_dynamodb" {
  name = "acceso-tabla-usuarios"
  role = aws_iam_role.usuarios.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "dynamodb:Query",
      ]
      Resource = [
        aws_dynamodb_table.usuarios.arn,
        "${aws_dynamodb_table.usuarios.arn}/index/*",
      ]
    }]
  })
}

resource "aws_lambda_function" "usuarios" {
  function_name    = "usuarios-api"
  runtime          = "python3.12"
  handler          = "lambda_function.lambda_handler"
  role             = aws_iam_role.usuarios.arn
  filename         = data.archive_file.usuarios.output_path
  source_code_hash = data.archive_file.usuarios.output_base64sha256
  timeout          = 10

  environment {
    variables = {
      TABLA_USUARIOS = aws_dynamodb_table.usuarios.name
    }
  }
}
