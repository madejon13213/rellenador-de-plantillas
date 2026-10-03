"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const enlaces = [
  { href: "/", texto: "Generar" },
  { href: "/usuarios", texto: "Usuarios" },
  { href: "/plantillas", texto: "Plantillas" },
];

export default function Nav() {
  const ruta = usePathname();
  return (
    <header className="border-b border-zinc-200 dark:border-zinc-800">
      <nav className="mx-auto flex max-w-5xl items-center gap-6 px-4 py-3">
        <span className="font-semibold">Rellenador de plantillas</span>
        {enlaces.map(({ href, texto }) => (
          <Link
            key={href}
            href={href}
            className={
              ruta === href
                ? "text-sm font-medium text-blue-600"
                : "text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            }
          >
            {texto}
          </Link>
        ))}
      </nav>
    </header>
  );
}
