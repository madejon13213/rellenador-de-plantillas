import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";
import { Icono, type NombreIcono } from "@/components/iconos";

export const campo =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm " +
  "placeholder:text-zinc-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 " +
  "dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500";

export function Campo({
  etiqueta,
  icono,
  ...props
}: { etiqueta: string; icono?: NombreIcono } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300">
      {etiqueta}
      <span className="relative block">
        {icono && (
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-zinc-400">
            <Icono nombre={icono} className="h-4 w-4" />
          </span>
        )}
        <input {...props} className={`${campo} ${icono ? "pl-9" : ""}`} />
      </span>
    </label>
  );
}

export function Selector({
  etiqueta,
  children,
  ...props
}: { etiqueta: string; children: ReactNode } & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300">
      {etiqueta}
      <select {...props} className={campo}>
        {children}
      </select>
    </label>
  );
}

export function Boton({
  variante = "primario",
  className = "",
  ...props
}: { variante?: "primario" | "secundario" | "peligro" | "fantasma" } & ButtonHTMLAttributes<HTMLButtonElement>) {
  const estilos = {
    primario:
      "bg-indigo-600 text-white shadow-sm hover:bg-indigo-700 focus-visible:outline-indigo-600",
    secundario:
      "border border-zinc-300 bg-white text-zinc-700 shadow-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800",
    peligro:
      "border border-red-200 bg-white text-red-600 hover:bg-red-50 dark:border-red-900 dark:bg-transparent dark:text-red-400 dark:hover:bg-red-950",
    fantasma: "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800",
  }[variante];
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${estilos} ${className}`}
    />
  );
}

export function Aviso({ mensaje, tipo = "error" }: { mensaje: string | null; tipo?: "error" | "ok" | "info" }) {
  if (!mensaje) return null;
  const estilos = {
    error: "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300",
    ok: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300",
    info: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-300",
  }[tipo];
  return (
    <p role="alert" className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm ${estilos}`}>
      <Icono nombre={tipo === "ok" ? "check" : "alerta"} className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{mensaje}</span>
    </p>
  );
}

export function Tarjeta({
  titulo,
  descripcion,
  children,
  className = "",
}: {
  titulo?: string;
  descripcion?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 ${className}`}
    >
      {titulo && (
        <header className="mb-5">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">{titulo}</h2>
          {descripcion && <p className="mt-0.5 text-sm text-zinc-500">{descripcion}</p>}
        </header>
      )}
      {children}
    </section>
  );
}

export function Cabecera({ titulo, descripcion }: { titulo: string; descripcion?: string }) {
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">{titulo}</h1>
      {descripcion && <p className="mt-1 text-zinc-500">{descripcion}</p>}
    </div>
  );
}

export function Vacio({ icono, texto, children }: { icono: NombreIcono; texto: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-zinc-300 px-6 py-10 text-center dark:border-zinc-700">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300">
        <Icono nombre={icono} />
      </span>
      <p className="text-sm text-zinc-500">{texto}</p>
      {children}
    </div>
  );
}

// Círculo con la inicial de un nombre.
export function Avatar({ nombre, className = "h-9 w-9 text-sm" }: { nombre: string; className?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-sky-400 font-semibold uppercase text-white ${className}`}
    >
      {nombre.trim().charAt(0) || "?"}
    </span>
  );
}
