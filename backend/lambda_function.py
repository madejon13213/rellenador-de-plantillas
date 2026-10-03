import base64
import io
import json
import os

from docxtpl import DocxTemplate

PLANTILLA = os.path.join(os.path.dirname(__file__), "templates", "plantilla.docx")

# campo -> longitud máxima
CAMPOS = {
    "nombre_completo": 150,
    "dni": 20,
    "direccion": 200,
    "ciudad": 100,
    "fecha": 50,
    "motivo": 2000,
}


def _error(status, mensaje, **extra):
    return {
        "statusCode": status,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps({"error": mensaje, **extra}, ensure_ascii=False),
    }


def lambda_handler(event, context):
    try:
        body = event.get("body") or ""
        if event.get("isBase64Encoded"):
            body = base64.b64decode(body).decode("utf-8")
        datos = json.loads(body)
        if not isinstance(datos, dict):
            raise ValueError
    except (ValueError, UnicodeDecodeError):
        return _error(400, "El cuerpo debe ser un JSON con los campos del formulario")

    faltan = [c for c in CAMPOS if not str(datos.get(c, "")).strip()]
    if faltan:
        return _error(400, "Faltan campos obligatorios", campos=faltan)

    largos = [c for c, maximo in CAMPOS.items() if len(str(datos[c])) > maximo]
    if largos:
        return _error(400, "Campos demasiado largos", campos=largos)

    contexto = {c: str(datos[c]).strip() for c in CAMPOS}

    doc = DocxTemplate(PLANTILLA)
    doc.render(contexto, autoescape=True)  # autoescape: &, < y > no rompen el XML
    salida = io.BytesIO()
    doc.save(salida)

    return {
        "statusCode": 200,
        "headers": {
            "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "Content-Disposition": 'attachment; filename="certificado.docx"',
        },
        "isBase64Encoded": True,
        "body": base64.b64encode(salida.getvalue()).decode("ascii"),
    }
