"use client";

import { useEffect, useState, type ReactNode } from "react";
import Nav from "@/components/Nav";
import { Aviso, Boton } from "@/components/ui";
import { cerrarSesion, iniciarSesion, usuarioActual } from "@/lib/auth";

type Estado = { fase: "cargando" } | { fase: "fuera" } | { fase: "dentro"; email: string };

// Envuelve toda la web: sin sesión iniciada solo se ve la pantalla de acceso.
export default function AuthProvider({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<Estado>({ fase: "cargando" });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    usuarioActual()
      .then((email) => setEstado(email ? { fase: "dentro", email } : { fase: "fuera" }))
      .catch((e) => {
        setError((e as Error).message);
        setEstado({ fase: "fuera" });
      });
  }, []);

  if (estado.fase === "cargando") {
    return <p className="p-8 text-sm text-zinc-500">Cargando…</p>;
  }

  if (estado.fase === "fuera") {
    return (
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-4 px-4">
        <h1 className="text-2xl font-semibold">Rellenador de plantillas</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Inicia sesión para continuar. Las cuentas las crea el administrador.
        </p>
        <Aviso mensaje={error} />
        <Boton onClick={() => iniciarSesion().catch((e) => setError((e as Error).message))}>
          Iniciar sesión
        </Boton>
      </main>
    );
  }

  return (
    <>
      <Nav email={estado.email} onCerrarSesion={() => cerrarSesion()} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
    </>
  );
}
