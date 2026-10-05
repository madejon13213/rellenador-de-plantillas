import base64
import binascii
import html
import io
import json
import os
import re
import uuid
import zipfile
from datetime import datetime, timezone

import boto3
from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError

TABLA = boto3.resource("dynamodb").Table(os.environ["TABLA_PLANTILLAS"])
S3 = boto3.client("s3")
BUCKET = os.environ["BUCKET_PLANTILLAS"]

# El archivo viaja en base64 dentro del JSON: API Gateway/Lambda admiten ~6 MB por petición,
# así que el .docx puede pesar como máximo unos 4 MB.
MAX_BYTES = 4 * 1024 * 1024
MAX_XML = 20 * 1024 * 1024  # protección ante zips que se expanden demasiado
MAX_NOMBRE = 100

PARTES_CON_TEXTO = re.compile(r"word/(document|header\d*|footer\d*)\.xml")
VARIABLE = re.compile(r"\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}")

PUBLICOS = ("plantilla_id", "nombre", "archivo_nombre", "campos", "tamano", "created_at")


class ErrorPeticion(Exception):
    def __init__(self, status, mensaje):
        self.status = status
        self.mensaje = mensaje


def respuesta(status, cuerpo=None):
    r = {"statusCode": status, "headers": {"Content-Type": "application/json"}}
    if cuerpo is not None:
        r["body"] = json.dumps(cuerpo, ensure_ascii=False, default=str)
    return r


def propietario(event):
    """Id de la cuenta que hace la petición (claim `sub` del token que ya validó API Gateway)."""
    try:
        return event["requestContext"]["authorizer"]["jwt"]["claims"]["sub"]
    except KeyError:
        raise ErrorPeticion(401, "No autenticado")


def publica(item):
    return {k: item[k] for k in PUBLICOS if k in item}


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


def extraer_campos(zf):
    """Devuelve los {{ campo }} del documento, sin repetir y en orden de aparición."""
    campos = []
    for parte in zf.namelist():
        if not PARTES_CON_TEXTO.fullmatch(parte):
            continue
        if zf.getinfo(parte).file_size > MAX_XML:
            raise ErrorPeticion(400, "El documento es demasiado grande")
        xml = zf.read(parte).decode("utf-8")
        # Quitar etiquetas une el texto aunque Word haya partido el campo en varios fragmentos.
        texto = html.unescape(re.sub(r"<[^>]+>", "", xml.replace("</w:p>", "\n")))
        for campo in VARIABLE.findall(texto):
            if campo not in campos:
                campos.append(campo)
    return campos


def crear(event):
    owner = propietario(event)
    datos = leer_json(event)

    nombre = str(datos.get("nombre", "")).strip()
    if not nombre:
        raise ErrorPeticion(400, "nombre: obligatorio")
    if len(nombre) > MAX_NOMBRE:
        raise ErrorPeticion(400, f"nombre: máximo {MAX_NOMBRE} caracteres")

    try:
        contenido = base64.b64decode(str(datos.get("archivo_base64", "")), validate=True)
    except (binascii.Error, ValueError):
        raise ErrorPeticion(400, "archivo_base64: no es base64 válido")
    if not contenido:
        raise ErrorPeticion(400, "archivo_base64: obligatorio")
    if len(contenido) > MAX_BYTES:
        raise ErrorPeticion(413, f"El archivo supera el máximo de {MAX_BYTES // (1024 * 1024)} MB")

    try:
        with zipfile.ZipFile(io.BytesIO(contenido)) as zf:
            if "word/document.xml" not in zf.namelist():
                raise zipfile.BadZipFile
            campos = extraer_campos(zf)
    except zipfile.BadZipFile:
        raise ErrorPeticion(400, "El archivo no es un .docx válido")

    plantilla_id = str(uuid.uuid4())
    clave = f"plantillas/{plantilla_id}.docx"
    item = {
        "plantilla_id": plantilla_id,
        "owner_id": owner,
        "nombre": nombre,
        "archivo_nombre": str(datos.get("archivo_nombre", ""))[:150],
        "campos": campos,
        "tamano": len(contenido),
        "s3_key": clave,
        "created_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }

    S3.put_object(
        Bucket=BUCKET,
        Key=clave,
        Body=contenido,
        ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    )
    try:
        TABLA.put_item(Item=item)
    except Exception:
        S3.delete_object(Bucket=BUCKET, Key=clave)  # no dejar archivos huérfanos
        raise
    return respuesta(201, publica(item))


def listar(event):
    owner = propietario(event)
    items, kwargs = [], {}
    while True:
        r = TABLA.query(
            IndexName="owner-index",
            KeyConditionExpression=Key("owner_id").eq(owner),
            **kwargs,
        )
        items.extend(r["Items"])
        if "LastEvaluatedKey" not in r:
            break
        kwargs["ExclusiveStartKey"] = r["LastEvaluatedKey"]
    items.sort(key=lambda p: p.get("created_at", ""), reverse=True)
    return respuesta(200, [publica(p) for p in items])


def obtener(event):
    owner = propietario(event)
    item = TABLA.get_item(Key={"plantilla_id": event["pathParameters"]["plantilla_id"]}).get("Item")
    # Una plantilla de otra cuenta se trata como si no existiera.
    if not item or item.get("owner_id") != owner:
        raise ErrorPeticion(404, "Plantilla no encontrada")
    return respuesta(200, publica(item))


def borrar(event):
    owner = propietario(event)
    clave_tabla = {"plantilla_id": event["pathParameters"]["plantilla_id"]}
    try:
        # Primero el registro: si el borrado del archivo fallara, solo quedaría un archivo
        # invisible, nunca un registro que apunte a un archivo que no existe.
        r = TABLA.delete_item(
            Key=clave_tabla,
            ConditionExpression="attribute_exists(plantilla_id) AND owner_id = :owner",
            ExpressionAttributeValues={":owner": owner},
            ReturnValues="ALL_OLD",
        )
    except ClientError as e:
        if e.response["Error"]["Code"] == "ConditionalCheckFailedException":
            raise ErrorPeticion(404, "Plantilla no encontrada")
        raise
    S3.delete_object(Bucket=BUCKET, Key=r["Attributes"]["s3_key"])
    return respuesta(204)


RUTAS = {
    "POST /plantillas": crear,
    "GET /plantillas": listar,
    "GET /plantillas/{plantilla_id}": obtener,
    "DELETE /plantillas/{plantilla_id}": borrar,
}


def lambda_handler(event, context):
    funcion = RUTAS.get(event.get("routeKey"))
    if funcion is None:
        return respuesta(404, {"error": "Ruta no encontrada"})
    try:
        return funcion(event)
    except ErrorPeticion as e:
        return respuesta(e.status, {"error": e.mensaje})
