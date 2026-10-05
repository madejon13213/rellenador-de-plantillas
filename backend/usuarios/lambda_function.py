import base64
import json
import os
import uuid
from datetime import datetime, timezone

import boto3
from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError

TABLA = boto3.resource("dynamodb").Table(os.environ["TABLA_USUARIOS"])

OBLIGATORIOS = ["nombre", "apellidos", "dni", "email"]
OPCIONALES = ["telefono", "direccion", "ciudad"]
CAMPOS = OBLIGATORIOS + OPCIONALES
MAX_LONGITUD = 200


class ErrorPeticion(Exception):
    def __init__(self, status, mensaje, **extra):
        self.status = status
        self.mensaje = mensaje
        self.extra = extra


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


def publico(item):
    return {k: v for k, v in item.items() if k != "owner_id"}


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


def validar(datos, parcial):
    """Devuelve (valores, errores). parcial=True: solo valida los campos presentes."""
    valores, errores = {}, []
    for campo in CAMPOS:
        if campo not in datos:
            if not parcial and campo in OBLIGATORIOS:
                errores.append(f"{campo}: obligatorio")
            continue
        valor = str(datos[campo]).strip()
        if not valor and campo in OBLIGATORIOS:
            errores.append(f"{campo}: no puede estar vacío")
        elif len(valor) > MAX_LONGITUD:
            errores.append(f"{campo}: máximo {MAX_LONGITUD} caracteres")
        else:
            valores[campo] = valor
    return valores, errores


def ahora():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def no_encontrado():
    return ErrorPeticion(404, "Usuario no encontrado")


def crear(event):
    owner = propietario(event)
    valores, errores = validar(leer_json(event), parcial=False)
    if errores:
        raise ErrorPeticion(400, "Datos no válidos", detalles=errores)
    item = {
        "user_id": str(uuid.uuid4()),
        "owner_id": owner,
        **valores,
        "created_at": ahora(),
        "updated_at": ahora(),
    }
    TABLA.put_item(Item=item)
    return respuesta(201, publico(item))


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
    items.sort(key=lambda u: (u.get("apellidos", "").lower(), u.get("nombre", "").lower()))
    return respuesta(200, [publico(u) for u in items])


def obtener(event):
    owner = propietario(event)
    item = TABLA.get_item(Key={"user_id": event["pathParameters"]["user_id"]}).get("Item")
    # Un usuario de otra cuenta se trata como si no existiera, para no revelar que está.
    if not item or item.get("owner_id") != owner:
        raise no_encontrado()
    return respuesta(200, publico(item))


def actualizar(event):
    owner = propietario(event)
    valores, errores = validar(leer_json(event), parcial=True)
    if errores:
        raise ErrorPeticion(400, "Datos no válidos", detalles=errores)
    if not valores:
        raise ErrorPeticion(400, "No hay ningún campo que actualizar")

    valores["updated_at"] = ahora()
    nombres = {f"#c{i}": campo for i, campo in enumerate(valores)}
    datos = {f":v{i}": valor for i, valor in enumerate(valores.values())}
    datos[":owner"] = owner
    expresion = "SET " + ", ".join(f"#c{i} = :v{i}" for i in range(len(valores)))
    try:
        r = TABLA.update_item(
            Key={"user_id": event["pathParameters"]["user_id"]},
            UpdateExpression=expresion,
            ExpressionAttributeNames=nombres,
            ExpressionAttributeValues=datos,
            ConditionExpression="attribute_exists(user_id) AND owner_id = :owner",
            ReturnValues="ALL_NEW",
        )
    except ClientError as e:
        if e.response["Error"]["Code"] == "ConditionalCheckFailedException":
            raise no_encontrado()
        raise
    return respuesta(200, publico(r["Attributes"]))


def borrar(event):
    owner = propietario(event)
    try:
        TABLA.delete_item(
            Key={"user_id": event["pathParameters"]["user_id"]},
            ConditionExpression="attribute_exists(user_id) AND owner_id = :owner",
            ExpressionAttributeValues={":owner": owner},
        )
    except ClientError as e:
        if e.response["Error"]["Code"] == "ConditionalCheckFailedException":
            raise no_encontrado()
        raise
    return respuesta(204)


RUTAS = {
    "POST /usuarios": crear,
    "GET /usuarios": listar,
    "GET /usuarios/{user_id}": obtener,
    "PUT /usuarios/{user_id}": actualizar,
    "DELETE /usuarios/{user_id}": borrar,
}


def lambda_handler(event, context):
    funcion = RUTAS.get(event.get("routeKey"))
    if funcion is None:
        return respuesta(404, {"error": "Ruta no encontrada"})
    try:
        return funcion(event)
    except ErrorPeticion as e:
        return respuesta(e.status, {"error": e.mensaje, **e.extra})
