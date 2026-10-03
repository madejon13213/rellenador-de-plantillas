import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";

export const campo =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 " +
  "focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 " +
  "dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";

export function Campo({
  etiqueta,
  ...props
}: { etiqueta: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium">
      {etiqueta}
      <input {...props} className={campo} />
    </label>
  );
}

export function Selector({
  etiqueta,
  children,
  ...props
}: { etiqueta: string; children: ReactNode } & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium">
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
}: { variante?: "primario" | "secundario" | "peligro" } & ButtonHTMLAttributes<HTMLButtonElement>) {
  const estilos = {
    primario: "bg-blue-600 text-white hover:bg-blue-700",
    secundario:
      "border border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800",
    peligro: "border border-red-300 text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950",
  }[variante];
  return (
    <button
      {...props}
      className={`rounded-md px-3 py-2 text-sm font-medium disabled:opacity-60 ${estilos} ${className}`}
    />
  );
}

export function Aviso({ mensaje }: { mensaje: string | null }) {
  if (!mensaje) return null;
  return (
    <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
      {mensaje}
    </p>
  );
}

export function Tarjeta({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
      <h2 className="mb-4 text-lg font-semibold">{titulo}</h2>
      {children}
    </section>
  );
}
