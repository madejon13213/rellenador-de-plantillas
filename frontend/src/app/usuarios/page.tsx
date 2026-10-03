"use client";

import { useCallback, useEffect, useState } from "react";
import { api, type Usuario, type UsuarioForm } from "@/lib/api";
import { Aviso, Boton, Campo, Tarjeta } from "@/components/ui";

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
      <h1 className="text-2xl font-semibold">Usuarios</h1>
      <Aviso mensaje={error} />

      <Tarjeta titulo={editando ? "Editar usuario" : "Nuevo usuario"}>
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

      <Tarjeta titulo={`Usuarios (${usuarios.length})`}>
        {cargando ? (
          <p className="text-sm text-zinc-500">Cargando…</p>
        ) : usuarios.length === 0 ? (
          <p className="text-sm text-zinc-500">Todavía no hay usuarios.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-200 text-zinc-500 dark:border-zinc-800">
                <tr>
                  <th className="py-2 pr-4 font-medium">Nombre</th>
                  <th className="py-2 pr-4 font-medium">DNI</th>
                  <th className="py-2 pr-4 font-medium">Email</th>
                  <th className="py-2 pr-4 font-medium">Ciudad</th>
                  <th className="py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {usuarios.map((u) => (
                  <tr key={u.user_id} className="border-b border-zinc-100 dark:border-zinc-900">
                    <td className="py-2 pr-4">{u.nombre} {u.apellidos}</td>
                    <td className="py-2 pr-4">{u.dni}</td>
                    <td className="py-2 pr-4">{u.email}</td>
                    <td className="py-2 pr-4">{u.ciudad}</td>
                    <td className="flex justify-end gap-2 py-2">
                      <Boton variante="secundario" onClick={() => empezarEdicion(u)}>Editar</Boton>
                      <Boton variante="peligro" onClick={() => borrar(u)}>Eliminar</Boton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Tarjeta>
    </div>
  );
}
