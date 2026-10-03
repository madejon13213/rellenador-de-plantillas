# El estado vive en S3 para que GitHub Actions y tu PC compartan el mismo.
# Sin esto, cada ejecución en Actions empezaría de cero e intentaría recrear el rol.
terraform {
  backend "s3" {
    bucket       = "tfstate-664342886904-eu-north-1"
    key          = "hola-lambda/terraform.tfstate"
    region       = "eu-north-1"
    encrypt      = true
    use_lockfile = true # bloqueo nativo en S3 (Terraform >= 1.10), no hace falta DynamoDB
  }
}
