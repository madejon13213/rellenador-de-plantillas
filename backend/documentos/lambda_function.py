import base64
import io
import json
import os
import re
import unicodedata
import uuid
from datetime import datetime, timezone
from urllib.parse import quote

import boto3
from botocore.config import Config
from docxtpl import DocxTemplate
from jinja2.exceptions import TemplateError

DYNAMO = boto3.resource("dynamodb")
T_USUARIOS = DYNAMO.Table(os.environ["TABLA_USUARIOS"])
T_PLANTILLAS = DYNAMO.Table(os.environ["TABLA_PLANTILLAS"])
T_DOCUMENTOS = DYNAMO.Table(os.environ["TABLA_DOCUMENTOS"])
S3 = boto3.client("s3", config=Config(signature_version="s3v4"))
BUCKET_PLANTILLAS = os.environ["BUCKET_PLANTILLAS"]
BUCKET_DOCUMENTOS = os.environ["BUCKET_DOCUMENTOS"]

SEGUNDOS_ENLACE = 300  # validez de la URL de descarga

PUBLICOS = (
    "documento_id", "plantilla_id", "plantilla_nombre", "user_id",
    "usuario_nombre", "archivo_nombre", "campos_sin_dato", "created_at",
)


class ErrorPeticion(Exception):
    def __init__(self, status, mensaje):
        self.status = status
        self.mensaje = mensaje


def respuesta(status, cuerpo=None):
    r = {"statusCode": status, "headers": {"Content-Type": "application/json"}}
    if cuerpo is not None:
        r["body"] = json.dumps(cuerpo, ensure_ascii=False, default=str)
    return r


def leer_json(event):
    try:
        body = event.get("body") or ""
        if event.get("isBase64Encoded"):
            body = base64.b64decode(body).decode("utf-8")
        datos = json.loads(body)
    except (ValueError, UnicodeDecodeError):
        raise ErrorPeticion(400, "El cuerpo debe ser un JSON válido")
    if not isinstance(datos, dict):
        raise ErrorPeticion(400, "El cuerpo debe ser un objeto JSON")
    return datos


def publico(item):
    return {k: item[k] for k in PUBLICOS if k in item}


def nombre_archivo(plantilla, usuario):
    base = f"{plantilla['nombre']} - {usuario.get('nombre', '')} {usuario.get('apellidos', '')}"
    base = re.sub(r"[^\w\s\-]", "", base).strip()
    return f"{base or 'documento'}.docx"


def url_descarga(item):
    """URL temporal de S3 que descarga el documento con un nombre legible."""
    ascii_ = unicodedata.normalize("NFKD", item["archivo_nombre"]).encode("ascii", "ignore").decode()
    disposicion = f'attachment; filename="{ascii_}"; filename*=UTF-8\'\'{quote(item["archivo_nombre"])}'
    return S3.generate_presigned_url(
        "get_object",
        Params={
            "Bucket": BUCKET_DOCUMENTOS,
            "Key": item["s3_key"],
            "ResponseContentDisposition": disposicion,
        },
        ExpiresIn=SEGUNDOS_ENLACE,
    )


def pedir_id(datos, campo):
    valor = str(datos.get(campo, "")).strip()
    if not valor:
        raise ErrorPeticion(400, f"{campo}: obligatorio")
    return valor


def generar(event):
    datos = leer_json(event)
    plantilla_id = pedir_id(datos, "plantilla_id")
    user_id = pedir_id(datos, "user_id")

    plantilla = T_PLANTILLAS.get_item(Key={"plantilla_id": plantilla_id}).get("Item")
    if not plantilla:
        raise ErrorPeticion(404, "Plantilla no encontrada")
    usuario = T_USUARIOS.get_item(Key={"user_id": user_id}).get("Item")
    if not usuario:
        raise ErrorPeticion(404, "Usuario no encontrado")

    contexto = {k: v for k, v in usuario.items() if isinstance(v, str)}
    campos_sin_dato = [c for c in plantilla.get("campos", []) if not contexto.get(c)]

    contenido = S3.get_object(Bucket=BUCKET_PLANTILLAS, Key=plantilla["s3_key"])["Body"].read()
    try:
        doc = DocxTemplate(io.BytesIO(contenido))
        doc.render(contexto, autoescape=True)  # autoescape: &, < y > no rompen el XML
    except TemplateError as e:
        raise ErrorPeticion(422, f"La plantilla no se pudo rellenar: {e}")
    salida = io.BytesIO()
    doc.save(salida)

    documento_id = str(uuid.uuid4())
    clave = f"documentos/{documento_id}.docx"
    item = {
        "documento_id": documento_id,
        "plantilla_id": plantilla_id,
        "plantilla_nombre": plantilla["nombre"],
        "user_id": user_id,
        "usuario_nombre": f"{usuario.get('nombre', '')} {usuario.get('apellidos', '')}".strip(),
        "archivo_nombre": nombre_archivo(plantilla, usuario),
        "campos_sin_dato": campos_sin_dato,
        "s3_key": clave,
        "created_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }

    S3.put_object(
        Bucket=BUCKET_DOCUMENTOS,
        Key=clave,
        Body=salida.getvalue(),
        ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    )
    try:
        T_DOCUMENTOS.put_item(Item=item)
    except Exception:
        S3.delete_object(Bucket=BUCKET_DOCUMENTOS, Key=clave)  # no dejar archivos huérfanos
        raise
    return respuesta(201, {**publico(item), "url_descarga": url_descarga(item)})


def listar(event):
    items, kwargs = [], {}
    while True:
        r = T_DOCUMENTOS.scan(**kwargs)
        items.extend(r["Items"])
        if "LastEvaluatedKey" not in r:
            break
        kwargs["ExclusiveStartKey"] = r["LastEvaluatedKey"]
    items.sort(key=lambda d: d.get("created_at", ""), reverse=True)
    return respuesta(200, [publico(d) for d in items])


def obtener(event):
    item = T_DOCUMENTOS.get_item(Key={"documento_id": event["pathParameters"]["documento_id"]}).get("Item")
    if not item:
        raise ErrorPeticion(404, "Documento no encontrado")
    return respuesta(200, {**publico(item), "url_descarga": url_descarga(item)})


RUTAS = {
    "POST /documentos": generar,
    "GET /documentos": listar,
    "GET /documentos/{documento_id}": obtener,
}


def lambda_handler(event, context):
    funcion = RUTAS.get(event.get("routeKey"))
    if funcion is None:
        return respuesta(404, {"error": "Ruta no encontrada"})
    try:
        return funcion(event)
    except ErrorPeticion as e:
        return respuesta(e.status, {"error": e.mensaje})
