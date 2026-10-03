const BASE = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");

export type Usuario = {
  user_id: string;
  nombre: string;
  apellidos: string;
  dni: string;
  email: string;
  telefono?: string;
  direccion?: string;
  ciudad?: string;
  created_at: string;
  updated_at: string;
};

export type UsuarioForm = Omit<Usuario, "user_id" | "created_at" | "updated_at">;

export type Plantilla = {
  plantilla_id: string;
  nombre: string;
  archivo_nombre: string;
  campos: string[];
  tamano: number;
  created_at: string;
};

export type Documento = {
  documento_id: string;
  plantilla_nombre: string;
  usuario_nombre: string;
  archivo_nombre: string;
  campos_sin_dato: string[];
  created_at: string;
  url_descarga?: string;
};

async function peticion<T>(ruta: string, metodo = "GET", cuerpo?: unknown): Promise<T> {
  if (!BASE) throw new Error("Falta NEXT_PUBLIC_API_URL en frontend/.env.local");

  let resp: Response;
  try {
    resp = await fetch(`${BASE}${ruta}`, {
      method: metodo,
      headers: cuerpo === undefined ? undefined : { "Content-Type": "application/json" },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    });
  } catch {
    throw new Error("No se pudo conectar con el servidor");
  }

  if (resp.status === 204) return undefined as T;
  const datos = await resp.json().catch(() => null);
  if (!resp.ok) {
    const detalles = Array.isArray(datos?.detalles) ? `: ${datos.detalles.join(", ")}` : "";
    throw new Error((datos?.error ?? `Error ${resp.status}`) + detalles);
  }
  return datos as T;
}

export function archivoABase64(archivo: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onload = () => resolve(String(lector.result).split(",")[1]);
    lector.onerror = () => reject(new Error("No se pudo leer el archivo"));
    lector.readAsDataURL(archivo);
  });
}

export const api = {
  usuarios: {
    listar: () => peticion<Usuario[]>("/usuarios"),
    crear: (u: UsuarioForm) => peticion<Usuario>("/usuarios", "POST", u),
    actualizar: (id: string, u: UsuarioForm) => peticion<Usuario>(`/usuarios/${id}`, "PUT", u),
    borrar: (id: string) => peticion<void>(`/usuarios/${id}`, "DELETE"),
  },
  plantillas: {
    listar: () => peticion<Plantilla[]>("/plantillas"),
    subir: (nombre: string, archivo: File, archivo_base64: string) =>
      peticion<Plantilla>("/plantillas", "POST", {
        nombre,
        archivo_nombre: archivo.name,
        archivo_base64,
      }),
    borrar: (id: string) => peticion<void>(`/plantillas/${id}`, "DELETE"),
  },
  documentos: {
    generar: (plantilla_id: string, user_id: string) =>
      peticion<Documento>("/documentos", "POST", { plantilla_id, user_id }),
    listar: () => peticion<Documento[]>("/documentos"),
    obtener: (id: string) => peticion<Documento>(`/documentos/${id}`),
  },
};

export function fecha(iso: string) {
  return new Date(iso).toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "short" });
}
