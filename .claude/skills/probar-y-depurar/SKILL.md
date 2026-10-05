---
name: probar-y-depurar
description: Cómo probar el rellenador de plantillas en local y tras desplegar, y cómo depurar fallos: arrancar la web, llamar a la API con token desde PowerShell, leer los logs de las Lambdas, y distinguir un error de CORS, un 401, un 404 o un 500. Úsala siempre que el usuario quiera probar algo, diga que "no funciona" o "me da error", pegue un error de la web, de la API o de PowerShell, o pregunte cómo comprobar que un cambio funciona, aunque no diga "depurar".
---

# Probar y depurar

El usuario trabaja en Windows con PowerShell y **no tiene Python instalado**. Eso fija qué se puede probar dónde:

| Qué | Dónde se prueba |
|---|---|
| Frontend (Next.js) | En local: `npm run dev` y comprobaciones de TypeScript |
| Lambdas (Python) y Terraform | Tras desplegar con un push; no se pueden ejecutar en local |
| Todo junto | La web contra la API real de AWS |

Cuando haya un fallo, **pide siempre el mensaje exacto** (texto de la web, del paso en rojo de Actions, o de la respuesta de la API). "No funciona" no basta para diagnosticar.

## Probar la web en local

Desde `infra`, genera `frontend/.env.local` con los datos de la API y el login, y arranca la web. Hay que reiniciar `npm run dev` cada vez que cambie ese archivo:

```powershell
@"
NEXT_PUBLIC_API_URL=$(terraform output -raw url_api)
NEXT_PUBLIC_COGNITO_USER_POOL_ID=$(terraform output -raw cognito_user_pool_id)
NEXT_PUBLIC_COGNITO_CLIENT_ID=$(terraform output -raw cognito_client_id)
"@ | Out-File ..\frontend\.env.local -Encoding ascii
cd ..\frontend
npm run dev
```

Se abre en `http://localhost:3000` (no `127.0.0.1`: el login y el CORS solo admiten `localhost`). Para entrar hay que registrarse desde la propia web (llega un código por email) o tener una cuenta creada por el administrador (ver `login-cognito`). Cada cuenta solo ve sus propios datos, así que una cuenta nueva empieza vacía.

Antes de dar un cambio de frontend por bueno: `npx tsc --noEmit`, `npm run lint` y `npm run build`. El build necesita las variables `NEXT_PUBLIC_*` (pueden ser falsas) y genera `out/`, igual que en el despliegue. Si `tsc` se queja de `LayoutProps`, es que falta la carpeta `.next` generada por Next: ejecuta antes `npm run build` o `npm run dev`.

## Probar la API desde PowerShell

Todas las rutas exigen token, así que la primera comprobación útil es que **sin token responde 401**. Eso demuestra que la protección funciona:

```powershell
$api = terraform output -raw url_api    # desde infra
Invoke-RestMethod "$api/usuarios"       # debe fallar con 401
```

Para llamar con sesión hay dos caminos. El primero no toca la infraestructura:

1. Inicia sesión en la web. En el navegador, `F12` → *Application* → *Local Storage* → la entrada que termina en `.accessToken` (`CognitoIdentityServiceProvider.<cliente>.<usuario>.accessToken`). Copia el valor. Dura 60 minutos.
2. Úsalo:

```powershell
$h = @{ Authorization = "Bearer $token" }
Invoke-RestMethod "$api/usuarios" -Headers $h
```

El segundo camino, **solo para pruebas y revirtiéndolo después**: añadir `ALLOW_USER_PASSWORD_AUTH` a `explicit_auth_flows` del cliente en `auth.tf` y pedir el token con `aws cognito-idp initiate-auth --auth-flow USER_PASSWORD_AUTH`. Obliga a escribir la contraseña en la línea de comandos y debilita el cliente, así que no lo propongas como primera opción.

Reglas para que las llamadas no fallen por culpa de PowerShell:

- **Cuerpos con acentos:** en PowerShell 5.1 hay que mandarlos como bytes UTF-8, o llegan rotos:
  `Invoke-RestMethod -Method Post -Uri "$api/usuarios" -Headers $h -ContentType "application/json; charset=utf-8" -Body ([Text.Encoding]::UTF8.GetBytes($body))`
- **Subir una plantilla:** el archivo va en base64 con una **ruta absoluta**: `[Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\ruta\plantilla.docx"))`. Con ruta relativa, .NET la resuelve desde otro directorio y falla.
- **IDs reales:** nunca uses `"1"` ni textos como `PEGA_ID`; el `plantilla_id` y el `user_id` salen de `GET /plantillas` y `GET /usuarios`. Un "Plantilla no encontrada" casi siempre es un id inventado.
- **Ver el cuerpo de un error:** `Invoke-RestMethod` oculta el mensaje de la API. Usa
  `try { ... } catch { $_.Exception.Response.StatusCode.value__; $_.ErrorDetails.Message }`.

El orden natural de una prueba completa: crear un usuario de la app, subir `backend/templates/plantilla-ejemplo.docx`, generar un documento, descargarlo con `url_descarga` (válida 5 minutos) y abrirlo para comprobar que los campos se rellenaron.

## Leer los logs de una Lambda

Lo que imprime una Lambda y sus errores van a CloudWatch. Función `x-api` (`usuarios-api`, `plantillas-api` o `documentos-api`):

```powershell
aws logs tail /aws/lambda/documentos-api --region eu-north-1 --since 15m
aws logs tail /aws/lambda/documentos-api --region eu-north-1 --follow      # en directo
```

Un error de Python aparece como un traceback con el nombre del archivo y la línea. Las peticiones rechazadas por el autorizador (401) **no** llegan a la Lambda, así que no dejan rastro en estos logs.

## Qué significa cada error

| Lo que se ve | Dónde mirar |
|---|---|
| "No se pudo conectar con el servidor" en la web | `F12` → *Console*: si dice CORS, falta el origen o la cabecera en `api.tf`; si no, URL equivocada o `.env.local` sin reiniciar |
| 401 | Falta el token, caducó o es de otro cliente; ver `login-cognito` |
| 403 | Casi siempre CORS o un permiso IAM (`AccessDenied`), no el login |
| 404 de un dato que existe | Es de otra cuenta (las Lambdas lo tratan como inexistente) o es un registro antiguo sin `owner_id` |
| 500 con `AccessDeniedException` de DynamoDB en los logs | Falta `dynamodb:Query` sobre el índice `owner-index` en el rol de esa Lambda |
| 404 `{"message":"Not Found"}` | La ruta o el método no existen en API Gateway (por ejemplo GET a una ruta POST, o una ruta nueva sin desplegar) |
| 404 `{"error":"Ruta no encontrada"}` | La petición llegó a la Lambda pero su diccionario `RUTAS` no tiene esa ruta: el texto debe coincidir con el `route_key` de `api.tf` |
| 404 `{"error":"... no encontrada"}` | La ruta existe pero el id no |
| 400 con `detalles` | Validación de la Lambda: faltan campos o son demasiado largos |
| 500 `Internal Server Error` | Falta `aws_lambda_permission`, o excepción en la Lambda: mira sus logs |
| 413 | La plantilla supera 4 MB |
| 422 | La plantilla tiene sintaxis Jinja rota (`{% if %}` sin cerrar) |

## Después de desplegar

1. Pestaña *Actions*: el workflow debe terminar en verde. Si no, pide el texto del paso en rojo y usa `infra-aws-despliegue`.
2. Comprueba que `terraform output url_api` devuelve lo esperado.
3. Prueba lo que cambiaste, no todo: una ruta nueva con su `curl`, un cambio de pantalla en la web.

No des por hecho que algo funciona porque el código compila: ni `tsc` ni `terraform validate` ejecutan la Lambda. Si no lo has probado en AWS, di que no está probado.
