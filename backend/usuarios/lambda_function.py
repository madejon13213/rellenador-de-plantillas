import base64
import json
import os
import uuid
from datetime import datetime, timezone

import boto3
from botocore.exceptions import ClientError

TABLA = boto3.resource("dynamodb").Table(os.environ["TABLA_USUARIOS"])

OBLIGATORIOS = ["nombre", "apellidos", "dni", "email"]
OPCIONALES = ["telefono", "direccion", "ciudad"]
CAMPOS = OBLIGATORIOS + OPCIONALES
MAX_LONGITUD = 200


def respuesta(status, cuerpo=None):
    r = {"statusCode": status, "headers": {"Content-Type": "application/json"}}
    if cuerpo is not None:
        r["body"] = json.dumps(cuerpo, ensure_ascii=False, default=str)
    return r


def leer_json(event):
    body = event.get("body") or ""
    if event.get("isBase64Encoded"):
        body = base64.b64decode(body).decode("utf-8")
    datos = json.loads(body)
    if not isinstance(datos, dict):
        raise ValueError("El cuerpo debe ser un objeto JSON")
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


def crear(event):
    valores, errores = validar(leer_json(event), parcial=False)
    if errores:
        return respuesta(400, {"error": "Datos no válidos", "detalles": errores})
    item = {"user_id": str(uuid.uuid4()), **valores, "created_at": ahora(), "updated_at": ahora()}
    TABLA.put_item(Item=item)
    return respuesta(201, item)


def listar(event):
    items, kwargs = [], {}
    while True:
        r = TABLA.scan(**kwargs)
        items.extend(r["Items"])
        if "LastEvaluatedKey" not in r:
            break
        kwargs["ExclusiveStartKey"] = r["LastEvaluatedKey"]
    items.sort(key=lambda u: (u.get("apellidos", "").lower(), u.get("nombre", "").lower()))
    return respuesta(200, items)


def obtener(event):
    item = TABLA.get_item(Key={"user_id": event["pathParameters"]["user_id"]}).get("Item")
    return respuesta(200, item) if item else respuesta(404, {"error": "Usuario no encontrado"})


def actualizar(event):
    valores, errores = validar(leer_json(event), parcial=True)
    if errores:
        return respuesta(400, {"error": "Datos no válidos", "detalles": errores})
    if not valores:
        return respuesta(400, {"error": "No hay ningún campo que actualizar"})

    valores["updated_at"] = ahora()
    nombres = {f"#c{i}": campo for i, campo in enumerate(valores)}
    datos = {f":v{i}": valor for i, valor in enumerate(valores.values())}
    expresion = "SET " + ", ".join(f"#c{i} = :v{i}" for i in range(len(valores)))
    try:
        r = TABLA.update_item(
            Key={"user_id": event["pathParameters"]["user_id"]},
            UpdateExpression=expresion,
            ExpressionAttributeNames=nombres,
            ExpressionAttributeValues=datos,
            ConditionExpression="attribute_exists(user_id)",
            ReturnValues="ALL_NEW",
        )
    except ClientError as e:
        if e.response["Error"]["Code"] == "ConditionalCheckFailedException":
            return respuesta(404, {"error": "Usuario no encontrado"})
        raise
    return respuesta(200, r["Attributes"])


def borrar(event):
    try:
        TABLA.delete_item(
            Key={"user_id": event["pathParameters"]["user_id"]},
            ConditionExpression="attribute_exists(user_id)",
        )
    except ClientError as e:
        if e.response["Error"]["Code"] == "ConditionalCheckFailedException":
            return respuesta(404, {"error": "Usuario no encontrado"})
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
    except (ValueError, UnicodeDecodeError):
        return respuesta(400, {"error": "El cuerpo debe ser un JSON válido"})
