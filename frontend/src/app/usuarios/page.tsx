"use client";

import { useCallback, useEffect, useState } from "react";
import { Icono } from "@/components/iconos";
import { Aviso, Avatar, Boton, Cabecera, Campo, Tarjeta, Vacio } from "@/components/ui";
import { api, type Usuario, type UsuarioForm } from "@/lib/api";

const VACIO: UsuarioForm = {
  nombre: "",
  apellidos: "",
  dni: "",
  email: "",
  telefono: "",
  direccion: "",
  ciudad: "",
};

export default function PaginaUsuarios() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [valores, setValores] = useState<UsuarioForm>(VACIO);
  const [editando, setEditando] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  // Recarga la lista tras crear, editar o borrar.
  const cargar = useCallback(async () => {
    try {
      setUsuarios(await api.usuarios.listar());
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    api.usuarios
      .listar()
      .then(setUsuarios)
      .catch((e) => setError((e as Error).message))
      .finally(() => setCargando(false));
  }, []);

  function cambiar(nombre: keyof UsuarioForm, valor: string) {
    setValores((v) => ({ ...v, [nombre]: valor }));
  }

  function empezarEdicion(u: Usuario) {
    setEditando(u.user_id);
    setValores({
      nombre: u.nombre,
      apellidos: u.apellidos,
      dni: u.dni,
      email: u.email,
      telefono: u.telefono ?? "",
      direccion: u.direccion ?? "",
      ciudad: u.ciudad ?? "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelar() {
    setEditando(null);
    setValores(VACIO);
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setGuardando(true);
    setError(null);
    try {
      if (editando) await api.usuarios.actualizar(editando, valores);
      else await api.usuarios.crear(valores);
      cancelar();
      await cargar();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setGuardando(false);
    }
  }

  async function borrar(u: Usuario) {
    if (!confirm(`¿Eliminar a ${u.nombre} ${u.apellidos}?`)) return;
    try {
      await api.usuarios.borrar(u.user_id);
      if (editando === u.user_id) cancelar();
      await cargar();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Cabecera titulo="Usuarios" descripcion="Las personas cuyos datos se usan para rellenar las plantillas." />
      <Aviso mensaje={error} />

      <Tarjeta
        titulo={editando ? "Editar usuario" : "Nuevo usuario"}
        descripcion={editando ? "Modifica los datos y guarda los cambios." : "Solo tú puedes ver los usuarios que añadas."}
      >
        <form onSubmit={guardar} className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Nombre" required maxLength={200} value={valores.nombre} onChange={(e) => cambiar("nombre", e.target.value)} />
          <Campo etiqueta="Apellidos" required maxLength={200} value={valores.apellidos} onChange={(e) => cambiar("apellidos", e.target.value)} />
          <Campo etiqueta="DNI" required maxLength={200} value={valores.dni} onChange={(e) => cambiar("dni", e.target.value)} />
          <Campo etiqueta="Email" type="email" required maxLength={200} value={valores.email} onChange={(e) => cambiar("email", e.target.value)} />
          <Campo etiqueta="Teléfono" maxLength={200} value={valores.telefono} onChange={(e) => cambiar("telefono", e.target.value)} />
          <Campo etiqueta="Ciudad" maxLength={200} value={valores.ciudad} onChange={(e) => cambiar("ciudad", e.target.value)} />
          <div className="sm:col-span-2">
            <Campo etiqueta="Dirección" maxLength={200} value={valores.direccion} onChange={(e) => cambiar("direccion", e.target.value)} />
          </div>
          <div className="flex gap-2 sm:col-span-2">
            <Boton type="submit" disabled={guardando}>
              <Icono nombre={editando ? "check" : "mas"} className="h-4 w-4" />
              {guardando ? "Guardando…" : editando ? "Guardar cambios" : "Crear usuario"}
            </Boton>
            {editando && (
              <Boton type="button" variante="secundario" onClick={cancelar}>
                Cancelar
              </Boton>
            )}
          </div>
        </form>
      </Tarjeta>

      <Tarjeta titulo={`Tus usuarios (${usuarios.length})`}>
        {cargando ? (
          <p className="text-sm text-zinc-500">Cargando…</p>
        ) : usuarios.length === 0 ? (
          <Vacio icono="usuarios" texto="Todavía no has añadido ningún usuario." />
        ) : (
          <ul className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800">
            {usuarios.map((u) => (
              <li key={u.user_id} className="flex flex-wrap items-center gap-4 py-3 first:pt-0 last:pb-0">
                <Avatar nombre={u.nombre} className="h-10 w-10" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{u.nombre} {u.apellidos}</p>
                  <p className="truncate text-sm text-zinc-500">
                    {u.email} · {u.dni}{u.ciudad ? ` · ${u.ciudad}` : ""}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Boton variante="secundario" onClick={() => empezarEdicion(u)}>
                    <Icono nombre="editar" className="h-4 w-4" />
                    <span className="hidden sm:inline">Editar</span>
                  </Boton>
                  <Boton variante="peligro" onClick={() => borrar(u)} aria-label="Eliminar">
                    <Icono nombre="borrar" className="h-4 w-4" />
                  </Boton>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Tarjeta>
    </div>
  );
}
