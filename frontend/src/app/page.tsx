"use client";

import { useEffect, useState } from "react";
import { api, fecha, type Documento, type Plantilla, type Usuario } from "@/lib/api";
import { Aviso, Boton, Selector, Tarjeta } from "@/components/ui";

export default function PaginaGenerar() {
  const [plantillas, setPlantillas] = useState<Plantilla[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [historial, setHistorial] = useState<Documento[]>([]);
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

  const plantilla = plantillas.find((p) => p.plantilla_id === plantillaId);

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

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Generar documento</h1>
      <Aviso mensaje={error} />

      <Tarjeta titulo="Elige plantilla y usuario">
        <form onSubmit={generar} className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Selector etiqueta="Plantilla" required value={plantillaId} onChange={(e) => setPlantillaId(e.target.value)}>
              <option value="">Selecciona una plantilla…</option>
              {plantillas.map((p) => (
                <option key={p.plantilla_id} value={p.plantilla_id}>{p.nombre}</option>
              ))}
            </Selector>
            <Selector etiqueta="Usuario" required value={userId} onChange={(e) => setUserId(e.target.value)}>
              <option value="">Selecciona un usuario…</option>
              {usuarios.map((u) => (
                <option key={u.user_id} value={u.user_id}>{u.nombre} {u.apellidos}</option>
              ))}
            </Selector>
          </div>

          {plantilla && (
            <p className="text-sm text-zinc-500">
              Campos de la plantilla: {plantilla.campos.length ? plantilla.campos.join(", ") : "ninguno"}
            </p>
          )}

          <div>
            <Boton type="submit" disabled={generando || !plantillaId || !userId}>
              {generando ? "Generando…" : "Generar documento"}
            </Boton>
          </div>
        </form>

        {resultado && (
          <div className="mt-5 flex flex-col gap-2 rounded-md bg-green-50 p-4 text-sm dark:bg-green-950">
            <p className="font-medium">Documento generado: {resultado.archivo_nombre}</p>
            {resultado.campos_sin_dato.length > 0 && (
              <p className="text-amber-700 dark:text-amber-400">
                Estos campos no tenían datos y han quedado vacíos: {resultado.campos_sin_dato.join(", ")}
              </p>
            )}
            <div>
              <a
                href={resultado.url_descarga}
                className="inline-block rounded-md bg-blue-600 px-3 py-2 font-medium text-white hover:bg-blue-700"
              >
                Descargar Word (.docx)
              </a>
            </div>
          </div>
        )}
      </Tarjeta>

      <Tarjeta titulo="Historial">
        {historial.length === 0 ? (
          <p className="text-sm text-zinc-500">Todavía no has generado ningún documento.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-900">
            {historial.map((d) => (
              <li key={d.documento_id} className="flex items-center justify-between gap-4 py-2 text-sm">
                <span>
                  {d.plantilla_nombre} · {d.usuario_nombre}
                  <span className="ml-2 text-xs text-zinc-500">{fecha(d.created_at)}</span>
                </span>
                <Boton variante="secundario" onClick={() => descargar(d)}>Descargar</Boton>
              </li>
            ))}
          </ul>
        )}
      </Tarjeta>
    </div>
  );
}
