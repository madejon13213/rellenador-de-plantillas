# Rellenador de plantillas

Web que genera un documento `.docx` a partir de una plantilla: el usuario rellena un formulario y descarga el resultado.

```
frontend/   Next.js (formulario)
backend/    Lambda en Python (rellena la plantilla) + templates/
infra/      Terraform (Lambda, API Gateway, ...)
.github/    Despliegue automático a AWS al hacer push a `development`
```

## Desarrollo

```bash
cd frontend
npm run dev        # http://localhost:3000
```

El backend y la infraestructura se despliegan con un push a la rama `development`.
