# Publicación de la web (Next.js exportado como estático): bucket S3 privado + CloudFront.
# Los archivos de frontend/out se suben al bucket; CloudFront los sirve por HTTPS.
locals {
  bucket_web = "web-${data.aws_caller_identity.actual.account_id}-eu-north-1"
}

# Bucket donde vive la web compilada. Privado: solo CloudFront puede leerlo.
resource "aws_s3_bucket" "web" {
  bucket = local.bucket_web
}

resource "aws_s3_bucket_public_access_block" "web" {
  bucket                  = aws_s3_bucket.web.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "web" {
  bucket = aws_s3_bucket.web.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Credencial con la que CloudFront se identifica ante S3 para poder leer el bucket privado (OAC).
resource "aws_cloudfront_origin_access_control" "web" {
  name                              = "web-oac"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# Pequeña función que se ejecuta en cada petición: convierte /usuarios en /usuarios/index.html.
# S3 no sabe servir "carpetas", y Next.js exporta cada página como <ruta>/index.html.
resource "aws_cloudfront_function" "rutas" {
  name    = "rellenador-rutas"
  runtime = "cloudfront-js-2.0"
  publish = true

  code = <<-EOT
    function handler(event) {
      var request = event.request;
      var uri = request.uri;
      if (uri.endsWith("/")) {
        request.uri += "index.html";
      } else if (!uri.includes(".")) {
        request.uri += "/index.html";
      }
      return request;
    }
  EOT
}

# La distribución de CloudFront: la dirección pública https://xxxx.cloudfront.net.
resource "aws_cloudfront_distribution" "web" {
  enabled             = false
  default_root_object = "index.html"
  price_class         = "PriceClass_100" # solo Europa y Norteamérica: la más barata

  origin {
    domain_name              = aws_s3_bucket.web.bucket_regional_domain_name
    origin_id                = "s3-web"
    origin_access_control_id = aws_cloudfront_origin_access_control.web.id
  }

  default_cache_behavior {
    target_origin_id       = "s3-web"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true
    cache_policy_id        = "658327ea-f89d-4fab-a63d-7e88639e58f6" # política gestionada "CachingOptimized"

    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.rutas.arn
    }
  }

  # S3 responde 403 (y no 404) cuando un archivo no existe: ambos muestran la página 404 de la web.
  custom_error_response {
    error_code         = 403
    response_code      = 404
    response_page_path = "/404.html"
  }

  custom_error_response {
    error_code         = 404
    response_code      = 404
    response_page_path = "/404.html"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true # certificado HTTPS de *.cloudfront.net
  }
}

# Regla del bucket: solo esta distribución de CloudFront puede leer los archivos.
data "aws_iam_policy_document" "web" {
  statement {
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.web.arn}/*"]

    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.web.arn]
    }
  }
}

resource "aws_s3_bucket_policy" "web" {
  bucket     = aws_s3_bucket.web.id
  policy     = data.aws_iam_policy_document.web.json
  depends_on = [aws_s3_bucket_public_access_block.web]
}

output "url_web" {
  value = "https://${aws_cloudfront_distribution.web.domain_name}"
}

output "bucket_web" {
  value = aws_s3_bucket.web.bucket
}

output "distribucion_web_id" {
  value = aws_cloudfront_distribution.web.id
}
