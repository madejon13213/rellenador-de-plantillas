"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Avatar, Boton } from "@/components/ui";
import { Icono, Logo, type NombreIcono } from "@/components/iconos";
import type { Sesion } from "@/lib/auth";

const enlaces: { href: string; texto: string; icono: NombreIcono }[] = [
  { href: "/", texto: "Generar", icono: "chispas" },
  { href: "/usuarios/", texto: "Usuarios", icono: "usuarios" },
  { href: "/plantillas/", texto: "Plantillas", icono: "plantilla" },
];

export default function Nav({ sesion, onCerrarSesion }: { sesion: Sesion; onCerrarSesion: () => void }) {
  const ruta = usePathname();
  return (
    <header className="sticky top-0 z-10 border-b border-zinc-200/80 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
      <nav className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <Logo />
          <span className="hidden text-sm font-semibold sm:inline">Rellenador de plantillas</span>
        </Link>

        <div className="flex items-center gap-1">
          {enlaces.map(({ href, texto, icono }) => {
            const activo = ruta === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  activo
                    ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
                    : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                }`}
              >
                <Icono nombre={icono} className="h-4 w-4" />
                {texto}
              </Link>
            );
          })}
        </div>

        <div className="ml-auto flex items-center gap-3">
          <div className="hidden items-center gap-2 sm:flex">
            <Avatar nombre={sesion.nombre} className="h-8 w-8 text-xs" />
            <div className="leading-tight">
              <p className="text-sm font-medium">{sesion.nombre}</p>
              <p className="text-xs text-zinc-500">{sesion.email}</p>
            </div>
          </div>
          <Boton variante="secundario" onClick={onCerrarSesion} aria-label="Cerrar sesión">
            <Icono nombre="salir" className="h-4 w-4" />
            <span className="hidden sm:inline">Salir</span>
          </Boton>
        </div>
      </nav>
    </header>
  );
}
