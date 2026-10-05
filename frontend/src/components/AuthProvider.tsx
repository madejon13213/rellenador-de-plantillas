"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import AuthPantalla from "@/components/AuthPantalla";
import Nav from "@/components/Nav";
import { cerrarSesion, usuarioActual, type Sesion } from "@/lib/auth";

const SesionContext = createContext<Sesion | null>(null);

// Datos de la cuenta con sesión iniciada. Solo se puede usar dentro de las páginas protegidas.
export function useSesion(): Sesion {
  const sesion = useContext(SesionContext);
  if (!sesion) throw new Error("useSesion se usa fuera de AuthProvider");
  return sesion;
}

type Estado = { fase: "cargando" } | { fase: "fuera"; error?: string } | { fase: "dentro"; sesion: Sesion };

// Envuelve toda la web: sin sesión iniciada solo se ve la pantalla de acceso y registro.
export default function AuthProvider({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<Estado>({ fase: "cargando" });

  const comprobar = useCallback(async () => {
    try {
      const sesion = await usuarioActual();
      setEstado(sesion ? { fase: "dentro", sesion } : { fase: "fuera" });
    } catch (e) {
      setEstado({ fase: "fuera", error: (e as Error).message });
    }
  }, []);

  useEffect(() => {
    usuarioActual()
      .then((sesion) => setEstado(sesion ? { fase: "dentro", sesion } : { fase: "fuera" }))
      .catch((e) => setEstado({ fase: "fuera", error: (e as Error).message }));
  }, []);

  if (estado.fase === "cargando") {
    return (
      <div className="flex flex-1 items-center justify-center">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
      </div>
    );
  }

  if (estado.fase === "fuera") {
    return <AuthPantalla errorInicial={estado.error} onEntrar={comprobar} />;
  }

  return (
    <SesionContext.Provider value={estado.sesion}>
      <Nav sesion={estado.sesion} onCerrarSesion={() => cerrarSesion().then(comprobar)} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">{children}</main>
    </SesionContext.Provider>
  );
}
