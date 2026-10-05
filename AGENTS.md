# Rellenador de plantillas

Aplicación web que genera documentos Word a partir de una plantilla `.docx` y los datos de un usuario guardados en base de datos. El usuario elige una plantilla y una persona, y la app rellena los campos `{{ campo }}` de la plantilla con los datos de esa persona y deja descargar el resultado.

## Qué hace

- **Cuentas y datos:** cualquiera puede registrarse (con código de verificación por email) e iniciar sesión. **Cada cuenta solo ve y toca sus propios datos**: usuarios, plantillas y documentos llevan `owner_id`.
- **Usuarios:** alta, listado, edición y borrado. Campos: `nombre`, `apellidos`, `dni`, `email` (obligatorios) y `telefono`, `direccion`, `ciudad` (opcionales).
- **Plantillas:** se suben como `.docx` (máx. 4 MB). Al subirlas se detectan automáticamente los campos `{{ campo }}` que contienen. Se pueden listar y borrar.
- **Documentos:** se elige plantilla + usuario, se genera el `.docx` relleno, se guarda en S3 y se anota en un historial. Los campos de la plantilla sin dato en el usuario quedan vacíos y se avisa de cuáles son.
- **Web publicada** en S3 + CloudFront (`infra/web.tf`), desplegada por el mismo workflow tras el `apply`. Su dirección es la salida `url_web` de Terraform.
- **Login con Amazon Cognito:** pantallas propias de acceso y registro; la API valida el JWT en API Gateway (todas las rutas) y las Lambdas filtran por propietario. Ver `login-cognito`.
- **Pendiente:** descarga en PDF (requiere convertir con LibreOffice en una Lambda con contenedor), MFA, roles (por ejemplo un administrador que lo vea todo) y límites de uso.

## Arquitectura

```
Navegador (Next.js) ──fetch──▶ API Gateway (HTTP API) ──▶ Lambda ──▶ DynamoDB / S3
```

Tres Lambdas en Python 3.12, una por responsabilidad, detrás de un único API Gateway:

| Lambda | Rutas | Guarda en |
|---|---|---|
| `usuarios-api` | `GET/POST /usuarios`, `GET/PUT/DELETE /usuarios/{user_id}` | tabla `usuarios` |
| `plantillas-api` | `GET/POST /plantillas`, `GET/DELETE /plantillas/{plantilla_id}` | tabla `plantillas` + bucket de plantillas |
| `documentos-api` | `GET/POST /documentos`, `GET /documentos/{documento_id}` | tabla `documentos` + bucket de documentos |

Los documentos generados no pasan por la API al descargarse: la Lambda devuelve una URL temporal (5 min) de S3.

## Stack

- **Frontend:** Next.js (App Router), TypeScript, Tailwind. En `frontend/`.
- **Backend:** Python 3.12 en AWS Lambda. En `backend/`. `docxtpl` solo en `documentos`.
- **Infraestructura:** Terraform sobre AWS, región `eu-north-1` (Estocolmo). En `infra/`.
- **Despliegue:** GitHub Actions. Un push a la rama `development` ejecuta `terraform apply`.
- **Estado de Terraform:** bucket S3 `tfstate-664342886904-eu-north-1`, clave `usuarios/terraform.tfstate`.

## Skills del proyecto

Antes de tocar estos temas, carga la skill correspondiente (están en `.claude/skills/`):

- `estructura-proyecto`: dónde va cada archivo, nombres, y cómo se escribe una Lambda y una página del frontend.
- `infra-aws-despliegue`: Terraform, API Gateway, GitHub Actions, permisos de `github-deploy` y el checklist para añadir una Lambda nueva.
- `plantillas-docx`: cómo se crean y suben las plantillas, cómo se guardan en S3 y cómo el id de la base de datos indica qué archivo usar.
- `login-cognito`: login, registro, datos por cuenta (`owner_id`), gestión de cuentas y errores de acceso.
- `probar-y-depurar`: cómo probar la web y la API (con token), leer logs y distinguir un 401, un CORS o un 500.

## Reglas que no se saltan

- No hay credenciales en el código ni en git. `.env.local` y los `.tfstate` están ignorados.
- Toda ruta nueva de la API lleva el autorizador JWT en `api.tf` (una ruta sin él queda pública) y, si toca datos, filtra por `owner_id` en la Lambda.
- Cada Lambda solo recibe los permisos que necesita sobre sus propios recursos.
- El usuario trabaja en Windows con PowerShell. Los comandos que le des deben ser de PowerShell, uno por bloque.
- Python no está instalado en su PC: lo que dependa de Python (empaquetado de `documentos`) se ejecuta en GitHub Actions, no en local.
- El usuario habla español: textos de la interfaz, mensajes de error y comentarios en español.

## Estado conocido

- En AWS quedan restos de una prueba antigua (Lambda `hola-mundo-tf`, API `hola-api-tf`, rol `hola-lambda-tf-rol`) cuyo estado está en la clave `hola-lambda/terraform.tfstate` del bucket de estado y ya no tiene código en el repo. No pertenecen a este proyecto y se pueden borrar a mano.
