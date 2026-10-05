"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSesion } from "@/components/AuthProvider";
import { Icono, type NombreIcono } from "@/components/iconos";
import { Aviso, Boton, Cabecera, Selector, Tarjeta, Vacio } from "@/components/ui";
import { api, fecha, type Documento, type Plantilla, type Usuario } from "@/lib/api";

function Estadistica({
  icono,
  valor,
  texto,
  href,
}: {
  icono: NombreIcono;
  valor: number | null;
  texto: string;
  href?: string;
}) {
  const contenido = (
    <div className="flex items-center gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900">
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300">
        <Icono nombre={icono} />
      </span>
      <div>
        <p className="text-2xl font-bold leading-none">{valor ?? "–"}</p>
        <p className="mt-1 text-sm text-zinc-500">{texto}</p>
      </div>
    </div>
  );
  return href ? <Link href={href}>{contenido}</Link> : contenido;
}

export default function PaginaGenerar() {
  const { nombre } = useSesion();
  const [plantillas, setPlantillas] = useState<Plantilla[] | null>(null);
  const [usuarios, setUsuarios] = useState<Usuario[] | null>(null);
  const [historial, setHistorial] = useState<Documento[] | null>(null);
  const [plantillaId, setPlantillaId] = useState("");
  const [userId, setUserId] = useState("");
  const [resultado, setResultado] = useState<Documento | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generando, setGenerando] = useState(false);

  useEffect(() => {
    Promise.all([api.plantillas.listar(), api.usuarios.listar(), api.documentos.listar()])
      .then(([p, u, d]) => {
        setPlantillas(p);
        setUsuarios(u);
        setHistorial(d);
      })
      .catch((e) => setError((e as Error).message));
  }, []);

  const plantilla = plantillas?.find((p) => p.plantilla_id === plantillaId);
  const usuario = usuarios?.find((u) => u.user_id === userId);

  // Campos de la plantilla para los que el usuario elegido no tiene dato.
  const sinDato =
    plantilla && usuario
      ? plantilla.campos.filter((c) => !(usuario as unknown as Record<string, unknown>)[c])
      : [];

  async function generar(e: React.FormEvent) {
    e.preventDefault();
    setGenerando(true);
    setError(null);
    setResultado(null);
    try {
      setResultado(await api.documentos.generar(plantillaId, userId));
      setHistorial(await api.documentos.listar());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setGenerando(false);
    }
  }

  async function descargar(d: Documento) {
    try {
      const { url_descarga } = await api.documentos.obtener(d.documento_id);
      if (url_descarga) window.open(url_descarga, "_self");
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const cargando = plantillas === null || usuarios === null;
  const faltanDatos = !cargando && (plantillas.length === 0 || usuarios.length === 0);

  return (
    <div className="flex flex-col gap-8">
      <Cabecera
        titulo={`Hola, ${nombre}`}
        descripcion="Genera documentos rellenando tus plantillas con los datos de tus usuarios."
      />

      <Aviso mensaje={error} />

      <div className="grid gap-4 sm:grid-cols-3">
        <Estadistica icono="plantilla" valor={plantillas?.length ?? null} texto="Plantillas" href="/plantillas/" />
        <Estadistica icono="usuarios" valor={usuarios?.length ?? null} texto="Usuarios" href="/usuarios/" />
        <Estadistica icono="documento" valor={historial?.length ?? null} texto="Documentos generados" />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Tarjeta
          className="lg:col-span-3"
          titulo="Generar un documento"
          descripcion="Elige una plantilla y la persona cuyos datos quieres usar."
        >
          {faltanDatos ? (
            <Vacio icono="chispas" texto="Para generar un documento necesitas al menos una plantilla y un usuario.">
              <div className="flex flex-wrap justify-center gap-2">
                {plantillas?.length === 0 && (
                  <Link href="/plantillas/" className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
                    Añadir una plantilla →
                  </Link>
                )}
                {usuarios?.length === 0 && (
                  <Link href="/usuarios/" className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
                    Añadir un usuario →
                  </Link>
                )}
              </div>
            </Vacio>
          ) : (
            <form onSubmit={generar} className="flex flex-col gap-5">
              <Selector etiqueta="1 · Plantilla" required value={plantillaId} onChange={(e) => setPlantillaId(e.target.value)}>
                <option value="">Selecciona una plantilla…</option>
                {plantillas?.map((p) => (
                  <option key={p.plantilla_id} value={p.plantilla_id}>{p.nombre}</option>
                ))}
              </Selector>

              {plantilla && (
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-zinc-500">
                  <span>Campos:</span>
                  {plantilla.campos.length === 0
                    ? "ninguno detectado"
                    : plantilla.campos.map((c) => (
                        <code key={c} className="rounded-md bg-zinc-100 px-1.5 py-0.5 dark:bg-zinc-800">{c}</code>
                      ))}
                </div>
              )}

              <Selector etiqueta="2 · Usuario" required value={userId} onChange={(e) => setUserId(e.target.value)}>
                <option value="">Selecciona un usuario…</option>
                {usuarios?.map((u) => (
                  <option key={u.user_id} value={u.user_id}>{u.nombre} {u.apellidos}</option>
                ))}
              </Selector>

              {sinDato.length > 0 && (
                <Aviso
                  tipo="info"
                  mensaje={`A ${usuario?.nombre} le faltan estos datos y quedarán en blanco: ${sinDato.join(", ")}.`}
                />
              )}

              <Boton type="submit" disabled={generando || !plantillaId || !userId} className="w-full py-2.5">
                <Icono nombre="chispas" className="h-4 w-4" />
                {generando ? "Generando…" : "Generar documento"}
              </Boton>
            </form>
          )}

          {resultado && (
            <div className="mt-5 flex flex-col gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500 text-white">
                  <Icono nombre="check" className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-medium text-emerald-900 dark:text-emerald-100">Documento generado</p>
                  <p className="text-sm text-emerald-700 dark:text-emerald-300">{resultado.archivo_nombre}</p>
                </div>
              </div>
              <a
                href={resultado.url_descarga}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700"
              >
                <Icono nombre="descargar" className="h-4 w-4" />
                Descargar Word (.docx)
              </a>
            </div>
          )}
        </Tarjeta>

        <Tarjeta className="lg:col-span-2" titulo="Historial reciente">
          {historial === null ? (
            <p className="text-sm text-zinc-500">Cargando…</p>
          ) : historial.length === 0 ? (
            <Vacio icono="documento" texto="Aquí aparecerán los documentos que generes." />
          ) : (
            <ul className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800">
              {historial.slice(0, 8).map((d) => (
                <li key={d.documento_id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300">
                    <Icono nombre="documento" className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{d.plantilla_nombre}</p>
                    <p className="truncate text-xs text-zinc-500">{d.usuario_nombre} · {fecha(d.created_at)}</p>
                  </div>
                  <Boton variante="fantasma" onClick={() => descargar(d)} aria-label="Descargar" className="px-2">
                    <Icono nombre="descargar" className="h-4 w-4" />
                  </Boton>
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>
      </div>
    </div>
  );
}
