---
name: estructura-proyecto
description: Estructura de carpetas y convenciones de código del rellenador de plantillas (frontend Next.js, backend Lambdas en Python, plantillas .docx). Úsala siempre que vayas a crear o mover archivos, añadir una Lambda, una ruta, una página del frontend o un campo de usuario, o cuando el usuario pregunte dónde va algo o cómo se llama, aunque no mencione "estructura" ni "convenciones".
---

# Estructura del proyecto

Esta skill dice dónde va cada cosa y cómo se escribe, para que el código nuevo se parezca al existente. Para Terraform, API Gateway y GitHub Actions usa `infra-aws-despliegue`.

## Árbol

```
.claude/skills/        skills del proyecto
.github/workflows/     deploy-development.yml (único workflow)
backend/
  usuarios/            lambda_function.py            (sin dependencias externas)
  plantillas/          lambda_function.py            (sin dependencias externas)
  documentos/          lambda_function.py + requirements.txt
  templates/           plantilla-ejemplo.docx        (plantillas de prueba, no se despliegan)
  build.sh             empaqueta las Lambdas con dependencias
  build/               salida de build.sh (ignorada por git)
frontend/              Next.js
  src/app/             páginas: / (generar), /usuarios, /plantillas
  src/components/      Nav.tsx, ui.tsx (Campo, Selector, Boton, Aviso, Tarjeta)
  src/lib/api.ts       único sitio que habla con la API
infra/                 Terraform (ver infra-aws-despliegue)
AGENTS.md              qué es la app
```

## Nombres

Todo en español, en minúsculas y en plural para los recursos: `usuarios`, `plantillas`, `documentos`. Una Lambda nueva `x` sigue este patrón en todas partes: carpeta `backend/x/`, función `x-api`, rol `x-lambda-rol`, tabla `x`, bucket `x-<cuenta>-eu-north-1`, fichero `infra/x.tf`, rutas `/x` y `/x/{x_id}` con `x_id` en singular (`user_id`, `plantilla_id`, `documento_id`).

Mantener el patrón no es estética: la política de `github-deploy` autoriza recursos por nombre, así que un nombre distinto falla con `AccessDenied` en el despliegue.

## Cómo es una Lambda

Cada Lambda es un único `lambda_function.py` con esta forma. Copia el de `backend/usuarios/` como base.

- **Handler `lambda_handler(event, context)`** que busca `event["routeKey"]` en un diccionario `RUTAS` (`"GET /usuarios/{user_id}": obtener`). Una ruta desconocida devuelve 404.
- **Helper `respuesta(status, cuerpo=None)`** que devuelve `statusCode`, `Content-Type: application/json` y el cuerpo con `ensure_ascii=False`. Los `204` van sin cuerpo.
- **Errores:** la excepción `ErrorPeticion(status, mensaje)` se captura en el handler y se convierte en `{"error": "..."}`. Los errores de validación añaden `"detalles": [...]` con una lista de textos.
- **Validación en la Lambda**, no solo en el frontend: campos obligatorios, longitudes máximas, tipos. Todo mensaje en español.
- **Config por variables de entorno** que define Terraform (`TABLA_USUARIOS`, `BUCKET_PLANTILLAS`…). Los clientes de boto3 se crean fuera del handler para reutilizarlos entre invocaciones.
- **Orden al escribir en dos sitios** (S3 y DynamoDB): primero S3 y luego la tabla, y si la tabla falla se borra el archivo. Al borrar, primero el registro y luego el archivo. Así nunca queda un registro apuntando a un archivo que no existe.
- **Sin dependencias** salvo que haga falta: `boto3` ya viene en el runtime. Si una Lambda necesita librerías, añade `requirements.txt` y registra la Lambda en `backend/build.sh` (detalle en `infra-aws-despliegue`).

## Modelo de datos

- `usuarios` (clave `user_id`, uuid): `nombre`, `apellidos`, `dni`, `email` obligatorios; `telefono`, `direccion`, `ciudad` opcionales; `created_at`, `updated_at`. Índice `email-index`.
- `plantillas` (clave `plantilla_id`): `nombre`, `archivo_nombre`, `campos` (lista detectada), `tamano`, `s3_key`, `created_at`. El archivo está en `plantillas/<id>.docx` del bucket de plantillas. `s3_key` es interno y no se devuelve en la API.
- `documentos` (clave `documento_id`): `plantilla_id`, `plantilla_nombre`, `user_id`, `usuario_nombre`, `archivo_nombre`, `campos_sin_dato`, `s3_key`, `created_at`. Guarda el nombre de la plantilla y del usuario tal y como estaban al generar, para que el historial sea legible aunque luego se borren.

**Añadir un campo de usuario** toca cuatro sitios: `OBLIGATORIOS`/`OPCIONALES` en `backend/usuarios/lambda_function.py`, el tipo `Usuario`/`UsuarioForm` en `frontend/src/lib/api.ts`, el formulario en `frontend/src/app/usuarios/page.tsx` y el texto de ayuda en `frontend/src/app/plantillas/page.tsx`. Los nombres de los campos son los mismos que se usan como `{{ campo }}` en las plantillas, así que un campo de usuario nuevo ya está disponible en ellas sin más cambios.

## Plantillas .docx

Los campos se escriben como `{{ nombre }}` (sintaxis de docxtpl/Jinja). Solo se detectan variables simples; no cuentan los bucles ni las condiciones `{% %}`. Si se genera una plantilla de prueba, que use los campos de usuario reales y se guarde en `backend/templates/`.

## Frontend

- **Next.js es una versión con cambios respecto a lo que se conoce de memoria.** Antes de escribir código lee la guía relevante en `frontend/node_modules/next/dist/docs/` (lo indica `frontend/AGENTS.md`).
- Las páginas son componentes cliente (`"use client"`) que cargan datos con `useEffect` y una cadena `.then()`. El linter de esta versión rechaza llamar a `setState` directamente desde una función invocada en el efecto, por eso la carga inicial va inline y una función `cargar` aparte solo recarga tras crear, editar o borrar.
- **Toda llamada a la API pasa por `src/lib/api.ts`** (objeto `api.usuarios.listar()`, etc.). Las páginas nunca llaman a `fetch` directamente. `peticion()` convierte los errores de la API en un mensaje legible.
- La dirección de la API sale de `NEXT_PUBLIC_API_URL` (sin ruta al final), en `frontend/.env.local`. Se genera con `terraform output -raw url_api` y no se sube a git; el ejemplo está en `.env.example`.
- **Login:** `src/lib/auth.ts` configura Amplify y expone `usuarioActual`, `iniciarSesion`, `cerrarSesion` y `tokenDeAcceso`. `src/components/AuthProvider.tsx` envuelve toda la web desde `layout.tsx`: sin sesión solo muestra la pantalla de acceso (que redirige al login de Cognito) y las páginas no se montan, así que no cargan datos. `peticion()` de `api.ts` añade el token a cada llamada. No pongas tokens en URLs ni logs. Las variables son `NEXT_PUBLIC_COGNITO_USER_POOL_ID`, `NEXT_PUBLIC_COGNITO_CLIENT_ID` y `NEXT_PUBLIC_COGNITO_DOMAIN`.
- Los componentes de formulario y avisos van en `src/components/ui.tsx`. Si algo se repite en dos páginas, se añade ahí.
- Antes de dar un cambio por bueno: `npx tsc --noEmit` y `npm run lint` sin errores.

## Cosas que fallan si se olvidan

- Los `.sh` deben tener saltos de línea Linux: `.gitattributes` fuerza `*.sh text eol=lf`. Sin eso, `build.sh` creado en Windows falla en GitHub.
- `requirements.txt` no puede estar vacío: `pip install -r` con un fichero vacío da error.
- En PowerShell, `[IO.File]::ReadAllBytes` con una ruta relativa busca desde el directorio de trabajo de PowerShell y no desde la carpeta actual. Usa rutas absolutas.
