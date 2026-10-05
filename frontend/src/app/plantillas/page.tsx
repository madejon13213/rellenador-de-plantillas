"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Icono } from "@/components/iconos";
import { Aviso, Boton, Cabecera, Campo, Tarjeta, Vacio } from "@/components/ui";
import { api, archivoABase64, fecha, type Plantilla } from "@/lib/api";

const MAX_BYTES = 4 * 1024 * 1024;

export default function PaginaPlantillas() {
  const [plantillas, setPlantillas] = useState<Plantilla[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [archivoNombre, setArchivoNombre] = useState("");
  const formulario = useRef<HTMLFormElement>(null);

  // Recarga la lista tras subir o borrar.
  const cargar = useCallback(async () => {
    try {
      setPlantillas(await api.plantillas.listar());
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    api.plantillas
      .listar()
      .then(setPlantillas)
      .catch((e) => setError((e as Error).message))
      .finally(() => setCargando(false));
  }, []);

  async function subir(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    const nombre = String(datos.get("nombre")).trim();
    const archivo = datos.get("archivo") as File;

    if (!archivo.name.toLowerCase().endsWith(".docx")) {
      setError("El archivo debe ser un .docx");
      return;
    }
    if (archivo.size > MAX_BYTES) {
      setError("El archivo supera el máximo de 4 MB");
      return;
    }

    setSubiendo(true);
    setError(null);
    try {
      await api.plantillas.subir(nombre, archivo, await archivoABase64(archivo));
      formulario.current?.reset();
      setArchivoNombre("");
      await cargar();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubiendo(false);
    }
  }

  async function borrar(p: Plantilla) {
    if (!confirm(`¿Eliminar la plantilla "${p.nombre}"?`)) return;
    try {
      await api.plantillas.borrar(p.plantilla_id);
      await cargar();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Cabecera titulo="Plantillas" descripcion="Documentos de Word con huecos que se rellenan con los datos de un usuario." />
      <Aviso mensaje={error} />

      <Tarjeta titulo="Añadir plantilla" descripcion="Solo tú podrás ver y usar las plantillas que subas.">
        <form ref={formulario} onSubmit={subir} className="flex flex-col gap-4">
          <Campo etiqueta="Nombre" name="nombre" required maxLength={100} placeholder="Ej.: Certificado básico" />

          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-zinc-300 px-6 py-8 text-center transition hover:border-indigo-400 hover:bg-indigo-50/50 dark:border-zinc-700 dark:hover:bg-indigo-950/30">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300">
              <Icono nombre="documento" />
            </span>
            <span className="text-sm font-medium">{archivoNombre || "Elige un archivo Word (.docx)"}</span>
            <span className="text-xs text-zinc-500">Máximo 4 MB</span>
            <input
              name="archivo"
              type="file"
              required
              accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="sr-only"
              onChange={(e) => setArchivoNombre(e.target.files?.[0]?.name ?? "")}
            />
          </label>

          <p className="text-sm text-zinc-500">
            Escribe los campos en el Word como {"{{ nombre }}"}, {"{{ apellidos }}"}, {"{{ dni }}"}, {"{{ email }}"},{" "}
            {"{{ telefono }}"}, {"{{ direccion }}"} o {"{{ ciudad }}"}.
          </p>
          <div>
            <Boton type="submit" disabled={subiendo}>
              <Icono nombre="mas" className="h-4 w-4" />
              {subiendo ? "Subiendo…" : "Subir plantilla"}
            </Boton>
          </div>
        </form>
      </Tarjeta>

      <Tarjeta titulo={`Tus plantillas (${plantillas.length})`}>
        {cargando ? (
          <p className="text-sm text-zinc-500">Cargando…</p>
        ) : plantillas.length === 0 ? (
          <Vacio icono="plantilla" texto="Todavía no has subido ninguna plantilla." />
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {plantillas.map((p) => (
              <li
                key={p.plantilla_id}
                className="flex flex-col gap-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300">
                    <Icono nombre="documento" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{p.nombre}</p>
                    <p className="truncate text-xs text-zinc-500">
                      {p.archivo_nombre} · {(p.tamano / 1024).toFixed(0)} KB · {fecha(p.created_at)}
                    </p>
                  </div>
                  <Boton variante="peligro" onClick={() => borrar(p)} aria-label="Eliminar">
                    <Icono nombre="borrar" className="h-4 w-4" />
                  </Boton>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {p.campos.length === 0 ? (
                    <span className="text-xs text-amber-600">Sin campos {"{{ }}"} detectados</span>
                  ) : (
                    p.campos.map((c) => (
                      <code key={c} className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-xs dark:bg-zinc-800">
                        {c}
                      </code>
                    ))
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Tarjeta>
    </div>
  );
}
