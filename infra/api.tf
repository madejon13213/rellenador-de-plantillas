# API Gateway (HTTP API): la URL pública que llama a las Lambdas.
resource "aws_apigatewayv2_api" "api" {
  name          = "rellenador-api"
  protocol_type = "HTTP"

  # Permite que la web llame a la API desde el navegador: en local (Next.js en :3000)
  # y publicada (la dirección de CloudFront).
  cors_configuration {
    allow_origins = [
      "http://localhost:3000",
      "https://${aws_cloudfront_distribution.web.domain_name}",
    ]
    allow_methods = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    allow_headers = ["content-type", "authorization"]
  }
}

# Stage $default con despliegue automático: cada cambio de ruta se publica solo.
resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.api.id
  name        = "$default"
  auto_deploy = true
}

# --- Rutas de /usuarios -> Lambda usuarios ---
resource "aws_apigatewayv2_integration" "usuarios" {
  api_id                 = aws_apigatewayv2_api.api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.usuarios.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "usuarios" {
  for_each = toset([
    "GET /usuarios",
    "POST /usuarios",
    "GET /usuarios/{user_id}",
    "PUT /usuarios/{user_id}",
    "DELETE /usuarios/{user_id}",
  ])

  api_id    = aws_apigatewayv2_api.api.id
  route_key = each.value
  target    = "integrations/${aws_apigatewayv2_integration.usuarios.id}"

  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_lambda_permission" "usuarios" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.usuarios.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.api.execution_arn}/*/*"
}

# --- Rutas de /plantillas -> Lambda plantillas ---
resource "aws_apigatewayv2_integration" "plantillas" {
  api_id                 = aws_apigatewayv2_api.api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.plantillas.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "plantillas" {
  for_each = toset([
    "GET /plantillas",
    "POST /plantillas",
    "GET /plantillas/{plantilla_id}",
    "DELETE /plantillas/{plantilla_id}",
  ])

  api_id    = aws_apigatewayv2_api.api.id
  route_key = each.value
  target    = "integrations/${aws_apigatewayv2_integration.plantillas.id}"

  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_lambda_permission" "plantillas" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.plantillas.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.api.execution_arn}/*/*"
}

# --- Rutas de /documentos -> Lambda documentos ---
resource "aws_apigatewayv2_integration" "documentos" {
  api_id                 = aws_apigatewayv2_api.api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.documentos.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "documentos" {
  for_each = toset([
    "GET /documentos",
    "POST /documentos",
    "GET /documentos/{documento_id}",
  ])

  api_id    = aws_apigatewayv2_api.api.id
  route_key = each.value
  target    = "integrations/${aws_apigatewayv2_integration.documentos.id}"

  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_lambda_permission" "documentos" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.documentos.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.api.execution_arn}/*/*"
}

output "url_api" {
  value = aws_apigatewayv2_api.api.api_endpoint
}
