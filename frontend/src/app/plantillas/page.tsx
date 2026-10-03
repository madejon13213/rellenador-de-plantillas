"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, archivoABase64, fecha, type Plantilla } from "@/lib/api";
import { Aviso, Boton, Campo, Tarjeta } from "@/components/ui";

const MAX_BYTES = 4 * 1024 * 1024;

export default function PaginaPlantillas() {
  const [plantillas, setPlantillas] = useState<Plantilla[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);
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
      <h1 className="text-2xl font-semibold">Plantillas</h1>
      <Aviso mensaje={error} />

      <Tarjeta titulo="Añadir plantilla">
        <form ref={formulario} onSubmit={subir} className="flex flex-col gap-4">
          <Campo etiqueta="Nombre" name="nombre" required maxLength={100} placeholder="Ej.: Certificado básico" />
          <label className="flex flex-col gap-1 text-sm font-medium">
            Archivo Word (.docx, máx. 4 MB)
            <input
              name="archivo"
              type="file"
              required
              accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="text-sm"
            />
          </label>
          <p className="text-sm text-zinc-500">
            Escribe los campos en el Word como {"{{ nombre }}"}, {"{{ apellidos }}"}, {"{{ dni }}"}, {"{{ email }}"},{" "}
            {"{{ telefono }}"}, {"{{ direccion }}"} o {"{{ ciudad }}"}.
          </p>
          <div>
            <Boton type="submit" disabled={subiendo}>
              {subiendo ? "Subiendo…" : "Subir plantilla"}
            </Boton>
          </div>
        </form>
      </Tarjeta>

      <Tarjeta titulo={`Plantillas (${plantillas.length})`}>
        {cargando ? (
          <p className="text-sm text-zinc-500">Cargando…</p>
        ) : plantillas.length === 0 ? (
          <p className="text-sm text-zinc-500">Todavía no hay plantillas.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-900">
            {plantillas.map((p) => (
              <li key={p.plantilla_id} className="flex items-start justify-between gap-4 py-3">
                <div className="flex flex-col gap-1">
                  <span className="font-medium">{p.nombre}</span>
                  <span className="text-xs text-zinc-500">
                    {p.archivo_nombre} · {(p.tamano / 1024).toFixed(0)} KB · {fecha(p.created_at)}
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {p.campos.length === 0 ? (
                      <span className="text-xs text-amber-600">Sin campos {"{{ }}"} detectados</span>
                    ) : (
                      p.campos.map((c) => (
                        <code key={c} className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs dark:bg-zinc-800">
                          {c}
                        </code>
                      ))
                    )}
                  </div>
                </div>
                <Boton variante="peligro" onClick={() => borrar(p)}>Eliminar</Boton>
              </li>
            ))}
          </ul>
        )}
      </Tarjeta>
    </div>
  );
}
