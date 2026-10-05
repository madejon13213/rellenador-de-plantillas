---
name: infra-aws-despliegue
description: Terraform, API Gateway, Lambdas, IAM y el workflow de GitHub Actions del rellenador de plantillas en AWS (eu-north-1). Úsala siempre que haya que añadir o cambiar una Lambda, una ruta de la API, una tabla o bucket, tocar el despliegue, ampliar los permisos del usuario github-deploy, o cuando falle el workflow o aparezca un AccessDenied, un error de terraform o un CORS, aunque el usuario no diga "Terraform" ni "Actions".
---

# Infraestructura y despliegue

Para la forma del código y las carpetas usa `estructura-proyecto`. Esta skill cubre cómo se despliega.

## Cómo está montado

- **Terraform** en `infra/`, un fichero por Lambda (`usuarios.tf`, `plantillas.tf`, `documentos.tf`), `dynamodb.tf` (tabla de usuarios), `api.tf` (API y todas las rutas) y `main.tf` (providers y estado).
- **Estado remoto** en el bucket `tfstate-664342886904-eu-north-1`, clave `usuarios/terraform.tfstate`, con bloqueo nativo (`use_lockfile`, necesita Terraform ≥ 1.10). No hay DynamoDB de bloqueo.
- **Despliegue:** `.github/workflows/deploy-development.yml` se lanza con un push a `development` (o a mano con *Run workflow*). Hace `build.sh`, `terraform init`, `validate`, `plan` y `apply -auto-approve`. Solo hay un entorno.
- **Credenciales de CI:** secrets de GitHub `AWS_ACCESS_KEY_ID` y `AWS_SECRET_ACCESS_KEY` del usuario IAM `github-deploy`, no del usuario administrador del dueño.
- **Local:** el dueño aplica a mano con su usuario administrador solo en casos puntuales. `terraform plan` en local falla mientras no exista `backend/build/documentos`, porque ese zip se genera con Python y no tiene Python instalado. El camino normal es siempre push.

## La web (S3 + CloudFront)

`infra/web.tf` crea el bucket privado `web-<cuenta>-eu-north-1` y una distribución de CloudFront que lo lee mediante OAC. Una CloudFront Function convierte `/usuarios` en `/usuarios/index.html`, porque Next.js se exporta como estático (`output: "export"` y `trailingSlash: true` en `frontend/next.config.ts`).

El workflow, tras el `apply`, lee `url_api`, `bucket_web` y `distribucion_web_id` con `terraform output -raw` (por eso `terraform_wrapper: false`), compila el frontend con `NEXT_PUBLIC_API_URL` apuntando a la API recién desplegada, hace `aws s3 sync out ... --delete` y crea una invalidación `/*` en CloudFront. La URL pública es la salida `url_web`.

- La dirección de CloudFront está en `allow_origins` del CORS de la API (`api.tf`), de modo que el navegador acepta las llamadas desde la web publicada.
- Cambiar la web o la API no exige tocar el otro lado: el push recompila todo.
- La política de `github-deploy` necesita `cloudfront:*` sobre `*` (los ids de distribución no se conocen de antemano) y `s3:*` sobre el bucket web.
- La primera vez, CloudFront tarda varios minutos en desplegarse y `terraform apply` espera a que termine.
- Un `403`/`404` en la web publicada suele ser que falta subir los archivos o que la función de rutas no coincide con la estructura de `out/`.

## API Gateway

Una única HTTP API (`rellenador-api`), no REST. Por cada Lambda hay cuatro piezas en `api.tf`, y un recurso nuevo debe seguir el mismo patrón:

```hcl
resource "aws_apigatewayv2_integration" "x" {
  api_id                 = aws_apigatewayv2_api.api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.x.invoke_arn
  payload_format_version = "2.0"   # el handler recibe routeKey y pathParameters en este formato
}

resource "aws_apigatewayv2_route" "x" {
  for_each  = toset(["GET /x", "POST /x", "GET /x/{x_id}", "DELETE /x/{x_id}"])
  api_id    = aws_apigatewayv2_api.api.id
  route_key = each.value
  target    = "integrations/${aws_apigatewayv2_integration.x.id}"
}

resource "aws_lambda_permission" "x" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.x.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.api.execution_arn}/*/*"
}
```

- Sin `aws_lambda_permission` la ruta devuelve 500 aunque todo lo demás esté bien: API Gateway no tiene derecho a invocar la función.
- El stage es `$default` con `auto_deploy = true`, así que las rutas nuevas se publican solas.
- **CORS** vive en el bloque `cors_configuration` de `aws_apigatewayv2_api`: hoy solo `http://localhost:3000`, métodos `GET/POST/PUT/DELETE/OPTIONS` y cabecera `content-type`. Cuando se publique el frontend hay que añadir su dominio en `allow_origins`. Un "No se pudo conectar" en la web con la API sana casi siempre es CORS o una URL equivocada. El navegador debe usar `localhost`, no `127.0.0.1`.
- Límites: 10 MB por petición en API Gateway y 6 MB en Lambda. Por eso las plantillas suben en base64 con un máximo de 4 MB y los documentos se descargan por URL temporal de S3 y no por la API.
- La salida `url_api` es la URL base sin ruta.

## Lambdas en Terraform

Cada `x.tf` define, por este orden: `archive_file`, rol IAM (`x-lambda-rol`) con `AWSLambdaBasicExecutionRole` más una política en línea mínima, y `aws_lambda_function` (runtime `python3.12`, handler `lambda_function.lambda_handler`, `source_code_hash` del zip, variables de entorno con nombres de tabla y bucket). Tablas en `PAY_PER_REQUEST`; buckets con bloqueo de acceso público y cifrado AES256.

- **Sin dependencias:** `archive_file` con `source_dir = "../backend/x"` y `excludes = ["__pycache__"]`.
- **Con dependencias:** `source_dir = "../backend/build/x"`. Añade `x/requirements.txt` y una sección en `backend/build.sh` que instale con `pip install -r ... -t build/x --platform manylinux2014_x86_64 --implementation cp --python-version 3.12 --only-binary=:all: --no-compile` y copie el `lambda_function.py`. Las librerías compiladas (`lxml`) tienen que ser las de Linux, por eso la bandera `--platform`.
- Si la Lambda es pesada (`docxtpl`), sube `memory_size` (512) y `timeout` (30).

## Permisos de `github-deploy` (aquí falla casi todo)

El usuario tiene una política **gestionada** `github-deploy-terraform` y ninguna en línea. Se pasó a gestionada porque las políticas en línea de un usuario suman un máximo de 2048 caracteres y se agotaban. Autoriza por **nombre de recurso**, no con comodines amplios: tablas, buckets, roles y funciones listados uno a uno. Los nombres de `documentos` ya estaban incluidos de antemano.

Al añadir un recurso con un nombre que no esté en la política, el workflow falla con `AccessDenied` y el usuario debe ampliarla. El texto completo de la política está en `references/politica-github-deploy.md`. Procedimiento:

1. Añade al JSON los ARN nuevos (tabla, bucket, rol, función).
2. Guarda una nueva versión como predeterminada:
   `aws iam create-policy-version --policy-arn arn:aws:iam::664342886904:policy/github-deploy-terraform --policy-document file://... --set-as-default`
3. **Una política gestionada admite como máximo 5 versiones.** Si da `LimitExceeded`, borra las antiguas con `aws iam list-policy-versions` y `aws iam delete-policy-version --version-id vN`.
4. Relanza el workflow desde *Actions → Run workflow*, sin push nuevo.

Dile siempre al usuario que ejecute esos comandos él mismo en su terminal: son operaciones sobre IAM de su cuenta.

## Checklist: añadir una Lambda nueva `x`

1. `backend/x/lambda_function.py` (y `requirements.txt` + sección en `build.sh` si tiene dependencias). Sigue `estructura-proyecto`.
2. `infra/x.tf` con tabla/bucket si hacen falta, rol, política mínima y función.
3. En `infra/api.tf`: integración, rutas y permiso (plantilla de arriba).
4. Si hay dependencias, añade el paso al workflow solo si no está ya (`setup-python` + `bash ../backend/build.sh`).
5. Amplía la política de `github-deploy` si los nombres no estaban previstos.
6. Añade los métodos a `src/lib/api.ts` y la página del frontend.
7. Commit y push a `development`; mirar *Actions*; probar con PowerShell.

## Diagnosticar un fallo de Actions

Pide siempre el texto del paso en rojo (la anotación "exit code 1" no dice nada). Las causas habituales:

| Mensaje | Causa |
|---|---|
| `AccessDenied` / `not authorized to perform` | Falta ampliar la política de `github-deploy` |
| `InvalidClientTokenId` | Secrets de GitHub ausentes o mal pegados |
| `EntityAlreadyExists` | El estado de S3 no conoce un recurso que ya existe (rol, tabla, bucket) |
| `Error acquiring the state lock` | Dos ejecuciones a la vez (CI y local); repetir |
| Falla `build.sh` | Dependencia sin versión precompilada para Linux, o `.sh` con saltos de línea de Windows |
| `Not Found` al llamar a la API | Ruta distinta, o llamada con GET a una ruta POST |
| `Internal Server Error` | Falta `aws_lambda_permission`, o error en la Lambda: `aws logs tail /aws/lambda/x-api --region eu-north-1 --since 15m` |

Si `aws` o `terraform` en local fallan por `AWS_PROFILE`, es una variable de entorno de la cuenta anterior que apunta a un perfil inexistente: `Remove-Item Env:AWS_PROFILE`.

## Probar la API desde PowerShell

Estando en `infra`, con `$api = terraform output -raw url_api`. En PowerShell 5.1 el JSON con acentos hay que enviarlo como bytes UTF-8:

```powershell
Invoke-RestMethod -Method Post -Uri "$api/usuarios" -ContentType "application/json; charset=utf-8" -Body ([Text.Encoding]::UTF8.GetBytes($body))
```

Para subir una plantilla, el archivo se convierte con `[Convert]::ToBase64String([IO.File]::ReadAllBytes("ruta absoluta"))`. No uses nunca IDs de ejemplo como `"1"`: obtén los reales con `GET /usuarios` y `GET /plantillas`.

## Qué no hacer

- No metas claves de AWS en el código, en `.tf` ni en el workflow.
- No cambies `key` ni `bucket` del estado sin migrarlo (`terraform init -migrate-state`): Terraform intentaría recrear todo.
- No renombres recursos ya desplegados sin necesidad: cambiar el nombre de una Lambda, tabla o bucket los destruye y los recrea (con los datos).
- No uses `terraform destroy` ni borres buckets con datos sin confirmarlo con el usuario.
