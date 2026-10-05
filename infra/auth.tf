# Login: Amazon Cognito (cuentas y contraseñas) + autorizador JWT en el API Gateway.
# La web tiene sus propias pantallas de acceso y registro; inicia sesión contra Cognito,
# recibe un token y lo manda en cada petición. API Gateway valida el token antes de llamar a ninguna Lambda.

resource "aws_cognito_user_pool" "main" {
  name = "rellenador-usuarios"

  # Se entra con el email.
  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  # Cualquiera puede crear su cuenta desde la web; debe confirmar el email con un código.
  # Cada cuenta solo ve sus propios datos (lo garantizan las Lambdas con el campo owner_id).
  admin_create_user_config {
    allow_admin_create_user_only = false
  }

  password_policy {
    minimum_length    = 12
    require_lowercase = true
    require_uppercase = true
    require_numbers   = true
    require_symbols   = true
  }

  verification_message_template {
    default_email_option = "CONFIRM_WITH_CODE"
    email_subject        = "Tu código de verificación"
    email_message        = "Tu código de verificación para el Rellenador de plantillas es {####}"
  }

  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  # MFA desactivado de momento. Para exigirlo (recomendado en producción):
  # mfa_configuration = "ON" y el bloque software_token_mfa_configuration { enabled = true }.
  mfa_configuration = "OFF"
}

# La aplicación web. Cliente público (sin secreto, porque el navegador no puede guardarlo)
# que inicia sesión con usuario y contraseña mediante SRP: la contraseña nunca viaja en claro.
resource "aws_cognito_user_pool_client" "web" {
  name         = "web"
  user_pool_id = aws_cognito_user_pool.main.id

  generate_secret = false

  explicit_auth_flows = ["ALLOW_USER_SRP_AUTH", "ALLOW_REFRESH_TOKEN_AUTH"]

  # El token se puede revocar al cerrar sesión.
  enable_token_revocation = true

  access_token_validity  = 60
  id_token_validity      = 60
  refresh_token_validity = 7
  token_validity_units {
    access_token  = "minutes"
    id_token      = "minutes"
    refresh_token = "days"
  }

  # No revelar si un email existe o no al fallar el login.
  prevent_user_existence_errors = "ENABLED"
}

# El autorizador del API Gateway: comprueba la firma, el emisor y la caducidad del token.
resource "aws_apigatewayv2_authorizer" "cognito" {
  api_id           = aws_apigatewayv2_api.api.id
  name             = "cognito-jwt"
  authorizer_type  = "JWT"
  identity_sources = ["$request.header.Authorization"]

  jwt_configuration {
    audience = [aws_cognito_user_pool_client.web.id]
    issuer   = "https://${aws_cognito_user_pool.main.endpoint}"
  }
}

output "cognito_user_pool_id" {
  value = aws_cognito_user_pool.main.id
}

output "cognito_client_id" {
  value = aws_cognito_user_pool_client.web.id
}
