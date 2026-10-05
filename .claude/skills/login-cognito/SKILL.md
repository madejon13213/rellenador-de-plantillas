---
name: login-cognito
description: Login, registro y aislamiento de datos por cuenta del rellenador de plantillas (Amazon Cognito, JWT en API Gateway, campo owner_id en DynamoDB). Úsala siempre que el usuario hable de iniciar sesión, registrarse, crear cuentas, contraseñas, recuperar contraseña, tokens, sesión caducada, un 401, que cada cuenta vea solo sus datos, MFA o roles, aunque no diga "Cognito" ni "JWT". No confundir con los "usuarios" de la app (personas cuyos datos rellenan las plantillas), que son otra cosa.
---

# Login, registro y datos por cuenta

Hay dos conceptos que se llaman "usuarios" y no se mezclan:

- **Cuentas de acceso** (Cognito): quien entra a la web. Se registran ellas mismas.
- **Usuarios de la app** (DynamoDB, tabla `usuarios`): las personas cuyos datos rellenan las plantillas. Cada cuenta crea los suyos desde la página *Usuarios*.

Un usuario de la app no tiene cuenta de acceso, ni al revés.

## Cómo funciona

```
Web (pantalla propia de login/registro) ── Amplify: signIn / signUp (SRP, la contraseña no viaja en claro)
        │                                           │
        │                                       Cognito  ── envía un código por email al registrarse
        ▼
tokens (ID, acceso y refresco), guardados por Amplify en el navegador
        │  cada petición:  Authorization: Bearer <access token>
        ▼
API Gateway (autorizador JWT) ── comprueba firma, emisor, audiencia y caducidad
        ▼
Lambda ── lee la cuenta en  event["requestContext"]["authorizer"]["jwt"]["claims"]["sub"]
```

Piezas, en `infra/auth.tf` salvo las del frontend:

- **User pool `rellenador-usuarios`:** entrada con email, **registro abierto** (`allow_admin_create_user_only = false`) con código de verificación por email (plantilla del mensaje en español), contraseña de 12+ caracteres con mayúscula, minúscula, número y símbolo, recuperación de contraseña por email, MFA desactivado.
- **Cliente `web`:** público (sin secreto), flujos `SRP` y `REFRESH_TOKEN_AUTH`, revocación de tokens activada, access e ID token de 60 minutos y refresh token de 7 días. **No hay dominio de login alojado ni OAuth**: las pantallas son de la propia web.
- **Autorizador `cognito-jwt`** del API Gateway: audiencia = cliente `web`, emisor = el user pool.
- **Frontend:** `src/lib/auth.ts` (Amplify, errores traducidos a español), `src/components/AuthPantalla.tsx` (login, registro, confirmar email, recuperar contraseña y cambio de contraseña temporal), `src/components/AuthProvider.tsx` (decide si mostrar la pantalla de acceso o la app, y expone `useSesion()` con email y nombre) y `peticion()` de `src/lib/api.ts`, que adjunta el token. Código y estructura en `estructura-proyecto`.

## Cada cuenta solo ve sus datos

Todo registro en DynamoDB lleva `owner_id` = el `sub` de la cuenta que lo creó. Las tres Lambdas lo aplican igual:

- **Crear:** guardan `owner_id` con el `sub` del token, nunca con un valor del cuerpo de la petición.
- **Listar:** `Query` sobre el índice `owner-index` (clave `owner_id`, orden `created_at`). No se hace `Scan`.
- **Leer, editar y borrar por id:** si el registro es de otra cuenta responde **404**, igual que si no existiera, para no revelar que está. En editar y borrar, además, la condición `owner_id = :owner` va dentro del propio `update_item`/`delete_item`, de modo que no hay hueco entre comprobar y escribir.
- **Generar un documento:** la plantilla **y** el usuario elegidos deben ser de la cuenta que llama.
- `owner_id` no se devuelve en las respuestas.

Regla para cualquier código nuevo: **una ruta que lee o escribe datos debe filtrar por propietario**. El autorizador solo garantiza quién eres, no qué puedes tocar.

Los registros creados antes de añadir esto no tienen `owner_id`, así que ninguna cuenta los ve (siguen en la tabla). Se pueden borrar desde la consola de DynamoDB.

## Registro, recuperación y errores frecuentes

El flujo es: registrarse → llega un código de 6 dígitos al email → confirmarlo → entra directamente. Si una cuenta sin confirmar intenta entrar, se le reenvía el código. Cognito envía los emails con su remitente por defecto, con un límite de unos 50 al día: para más volumen habría que configurar Amazon SES.

| Síntoma | Causa y arreglo |
|---|---|
| No llega el código | Mirar spam; "Reenviar código" en la pantalla. Límite diario del remitente por defecto de Cognito |
| "El email o la contraseña no son correctos" | Cuenta inexistente, mal escrita o sin confirmar. `aws cognito-idp admin-get-user` muestra su estado (`UNCONFIRMED`, `CONFIRMED`, `FORCE_CHANGE_PASSWORD`) |
| "La contraseña no cumple los requisitos" | Debe tener 12+ caracteres con mayúscula, minúscula, número y símbolo |
| La web dice "Faltan NEXT_PUBLIC_COGNITO_…" | Falta `frontend/.env.local` o las variables; reiniciar `npm run dev` (ver `probar-y-depurar`) |
| 401 con la sesión iniciada | Token de otro user pool o cliente, o caducado. Cerrar sesión y entrar. Comprobar emisor `https://cognito-idp.eu-north-1.amazonaws.com/<pool>` y audiencia = id del cliente `web` |
| 401 desde PowerShell | Es lo esperado sin token; ver `probar-y-depurar` |
| Un dato "no existe" siendo suyo | Es de otra cuenta, o es un registro antiguo sin `owner_id` |
| Error de CORS | Falta `authorization` en `allow_headers` o el origen en `allow_origins` (`api.tf`) |

## Gestionar cuentas (administrador, con su usuario de AWS)

`$pool` sale de `terraform output -raw cognito_user_pool_id`, dentro de `infra`. Las contraseñas las teclea el propio usuario: no las pidas ni las repitas en el chat.

```powershell
# Listar cuentas
aws cognito-idp list-users --user-pool-id $pool --query "Users[].Attributes[?Name=='email'].Value[]"
# Ver el estado de una cuenta
aws cognito-idp admin-get-user --user-pool-id $pool --username EMAIL
# Confirmar a mano una cuenta cuyo código no llega (solo si se conoce a la persona: no verifica el email)
aws cognito-idp admin-confirm-sign-up --user-pool-id $pool --username EMAIL
# Resetear una contraseña
aws cognito-idp admin-set-user-password --user-pool-id $pool --username EMAIL --password 'CONTRASEÑA' --permanent
# Bloquear sin borrar y cerrar todas las sesiones
aws cognito-idp admin-disable-user --user-pool-id $pool --username EMAIL
aws cognito-idp admin-user-global-sign-out --user-pool-id $pool --username EMAIL
# Borrar una cuenta (sus datos en DynamoDB y S3 quedan; se borran aparte)
aws cognito-idp admin-delete-user --user-pool-id $pool --username EMAIL
```

## Proteger una ruta nueva

En `infra/api.tf`, cada `aws_apigatewayv2_route` lleva `authorization_type = "JWT"` y `authorizer_id = aws_apigatewayv2_authorizer.cognito.id`. Si falta, la ruta queda **pública** sin que nada falle ni avise. Y en la Lambda, filtrar por propietario como se explica arriba. El autorizador no valida claims propios ni grupos: si algún día hay roles (`cognito:groups`), se comprueban dentro de la Lambda.

## Cosas que rompen cuentas o datos

- **`username_attributes` (entrar con email) no se puede cambiar** una vez creado el user pool: Terraform lo recrearía y **se perderían todas las cuentas**. No lo cambies ni renombres `aws_cognito_user_pool.main`.
- Las cuentas están ligadas a los datos por su `sub`. Si se recrea el user pool, las cuentas nuevas tendrán otro `sub` y los datos antiguos quedarían huérfanos.
- **`update-user-pool-client` por CLI sustituye toda la configuración del cliente** y deja a cero lo que no repitas. Los cambios del cliente se hacen en `auth.tf`.
- Los tokens van en `localStorage` (por defecto de Amplify). No los pegues en URLs, logs ni en el chat.
- El registro abierto permite que cualquiera cree cuentas: cada una solo ve lo suyo, pero consume Cognito, DynamoDB y S3 de tu cuenta. Si hace falta cerrarlo, `allow_admin_create_user_only = true` y volver a crear cuentas por CLI.

## Mejoras pendientes, por orden de valor

1. **MFA obligatorio:** `mfa_configuration = "ON"` con `software_token_mfa_configuration { enabled = true }` y una pantalla en la web para configurar la app de autenticación (TOTP). Con pantallas propias, hay que construir ese paso.
2. **Límite de peticiones** (throttling del stage o WAF) contra abusos, y de tamaño de datos por cuenta.
3. **Rotación de refresh tokens y `cookieStorage`** en lugar de `localStorage`. La rotación es incompatible con `ALLOW_REFRESH_TOKEN_AUTH`; comprobar antes que la versión de Amplify en uso la soporta.
4. **Amazon SES** como remitente de emails si el volumen supera el límite de Cognito.
5. **Roles** (por ejemplo un administrador que vea todo) con grupos de Cognito comprobados en las Lambdas.

Para el despliegue y los permisos (`cognito-idp:*` para `github-deploy`) ver `infra-aws-despliegue`.
