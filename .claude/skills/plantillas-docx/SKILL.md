---
name: plantillas-docx
description: Cómo se crean, suben y guardan las plantillas Word del rellenador (archivo en S3, id en DynamoDB, campos {{ campo }}). Úsala siempre que el usuario quiera crear o modificar una plantilla, añadir campos a una plantilla, subir una plantilla, preguntar dónde se guarda o cómo se enlaza con la base de datos, o cuando una plantilla salga "sin campos detectados", rellene un campo vacío o rechace el archivo, aunque no diga "S3" ni "docx".
---

# Plantillas Word

Una plantilla es un `.docx` normal de Word con huecos escritos como `{{ campo }}`. Al generar un documento, cada hueco se sustituye por el dato del usuario elegido.

## Dónde se guarda y cómo se enlaza

El archivo y su registro van por separado, unidos por el **id**:

```
POST /plantillas ──▶ S3:        bucket plantillas-<cuenta>-eu-north-1
                                clave  plantillas/<plantilla_id>.docx
                 └─▶ DynamoDB:  tabla plantillas, item { plantilla_id, nombre, campos,
                                                         tamano, s3_key, created_at ... }
```

Para generar un documento, `documentos-api` recibe un `plantilla_id`, lee ese item en DynamoDB, toma su `s3_key` y descarga el archivo de S3. Nadie busca por nombre de archivo ni por nombre de plantilla.

Esto está pensado así por tres razones, y conviene respetarlo si se toca el código:

- **El id es lo único que identifica la plantilla.** Dos plantillas pueden llamarse igual o subirse con el mismo nombre de archivo sin pisarse, porque cada archivo vive en su propia clave.
- **La clave de S3 es interna.** `s3_key` se guarda en el registro, pero la API nunca la devuelve. El bucket es privado y solo las Lambdas lo leen, así que nadie puede llegar a una plantilla sin pasar por la API.
- **Registro y archivo no se desincronizan.** Al subir se escribe primero S3 y luego la tabla (y si la tabla falla, se borra el archivo). Al borrar, primero el registro y luego el archivo. Nunca debe quedar un registro apuntando a un archivo que no existe.

## Crear una plantilla

1. **Abre Word** y escribe el documento como siempre, con su formato, tablas, cabeceras y pies. El formato se conserva al rellenar.
2. **Escribe los huecos** con la sintaxis `{{ nombre_campo }}`. El nombre debe ser **exactamente** uno de los campos del usuario: `nombre`, `apellidos`, `dni`, `email`, `telefono`, `direccion`, `ciudad`. Si añadiste campos de usuario, también esos (ver `estructura-proyecto`).
3. **Reglas del nombre del campo:** solo letras sin tilde, números y guion bajo, empezando por letra o `_`. `{{ fecha_nacimiento }}` vale; `{{ fecha nacimiento }}`, `{{ dirección }}` y `{{ Nombre }}` no coinciden con nada (los nombres distinguen mayúsculas).
4. **Escribe cada hueco de una sola vez.** Si lo tecleas y luego aplicas negrita a media palabra o Word lo corrige, puede partirlo en trozos. La detección lo tolera, pero si algo sale raro, borra el hueco y escríbelo de nuevo, o pégalo como texto sin formato.
5. **Guarda como `.docx`**, máximo 4 MB. No sirven `.doc` renombrados, `.odt`, ni archivos con contraseña.
6. **Súbela** desde la página *Plantillas* de la web (nombre + archivo) o con `POST /plantillas`. Al subirla se detectan los campos y se muestran como etiquetas. Revisa que salgan todos los que escribiste.

No hay ruta para editar una plantilla. Para cambiarla, sube la nueva versión y borra la antigua; tendrá un `plantilla_id` distinto. Los documentos ya generados siguen descargables, porque se guardan aparte con el nombre de la plantilla tal y como era.

## Qué pasa con los campos

- Un campo de la plantilla que el usuario no tiene rellenado (por ejemplo `telefono` vacío) **queda en blanco** y la respuesta incluye `campos_sin_dato` para que la web avise.
- Un campo que no existe en el usuario (`{{ fecha_firma }}`) también queda en blanco. Si el usuario lo necesita rellenado, hay que añadirlo al modelo de usuario.
- Los caracteres `&`, `<` y `>` en los datos no rompen el documento: se escapan al rellenar.
- Se detectan campos en el cuerpo, las cabeceras y los pies. Solo cuentan las variables simples: los bucles y condiciones `{% ... %}` funcionan al rellenar, pero no aparecen en la lista de campos.

## Plantilla de prueba

Hay una de ejemplo en `backend/templates/plantilla-ejemplo.docx` (certificado con los siete campos). Para generar otra con tus campos, desde la raíz del repo y con `npm install docx` hecho en cualquier carpeta:

```powershell
node .claude/skills/plantillas-docx/scripts/generar_plantilla.js backend/templates/ficha.docx "FICHA" nombre apellidos dni email
```

Valida los nombres de campo y escribe cada hueco en un único fragmento. Si el módulo `docx` no se encuentra, define `$env:NODE_PATH` con la carpeta `node_modules` donde lo instalaste. Las plantillas de `backend/templates/` son solo de prueba: no se despliegan, hay que subirlas por la web o la API.

## Si algo falla

| Síntoma | Causa probable |
|---|---|
| "Sin campos detectados" al subir | Huecos mal escritos (`{ nombre }`, llaves simples), o el documento no los tiene |
| Un campo sale en blanco en el documento | El nombre no coincide con el del usuario (tilde, mayúscula, espacio) o ese usuario no tiene el dato |
| "El archivo no es un .docx válido" | Es un `.doc` renombrado, está dañado o tiene contraseña |
| "El archivo supera el máximo de 4 MB" | Reduce las imágenes del documento |
| 422 "La plantilla no se pudo rellenar" | Hay sintaxis Jinja rota, por ejemplo un `{% if %}` sin cerrar con `{% endif %}` |
| "Plantilla no encontrada" al generar | El `plantilla_id` no existe: se borró, o se usó un id inventado |
| Hay registro pero falla al descargar la plantilla | El archivo no está en S3 (borrado a mano). Elimina el registro y vuelve a subirla |

## Si hay que cambiar el almacenamiento

El código que lee y escribe plantillas está en `backend/plantillas/lambda_function.py` (subir, listar, borrar) y en `backend/documentos/lambda_function.py` (la lee para rellenarla). Cualquier cambio de clave, bucket o campos del registro afecta a las dos. Los permisos sobre S3 están en `infra/plantillas.tf` (escritura y borrado) y `infra/documentos.tf` (solo lectura); para ellos ver `infra-aws-despliegue`.
