"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { Icono, Logo } from "@/components/iconos";
import { Aviso, Boton, Campo } from "@/components/ui";
import {
  cambiarPasswordTemporal,
  confirmarRecuperacion,
  confirmarRegistro,
  iniciarSesion,
  pedirRecuperacion,
  registrar,
  reenviarCodigo,
} from "@/lib/auth";

type Vista = "login" | "registro" | "confirmar" | "recuperar" | "restablecer" | "cambiar";

const REQUISITOS: { texto: string; cumple: (p: string) => boolean }[] = [
  { texto: "12 caracteres o más", cumple: (p) => p.length >= 12 },
  { texto: "Una mayúscula", cumple: (p) => /[A-Z]/.test(p) },
  { texto: "Una minúscula", cumple: (p) => /[a-z]/.test(p) },
  { texto: "Un número", cumple: (p) => /\d/.test(p) },
  { texto: "Un símbolo", cumple: (p) => /[^A-Za-z0-9]/.test(p) },
];

const passwordValida = (p: string) => REQUISITOS.every((r) => r.cumple(p));

function Requisitos({ password }: { password: string }) {
  return (
    <ul className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
      {REQUISITOS.map((r) => {
        const ok = r.cumple(password);
        return (
          <li key={r.texto} className={`flex items-center gap-1.5 ${ok ? "text-emerald-600" : "text-zinc-400"}`}>
            <Icono nombre="check" className={`h-3.5 w-3.5 ${ok ? "" : "opacity-40"}`} />
            {r.texto}
          </li>
        );
      })}
    </ul>
  );
}

function Ventaja({ texto }: { texto: string }) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/20">
        <Icono nombre="check" className="h-3 w-3" />
      </span>
      {texto}
    </li>
  );
}

export default function AuthPantalla({
  errorInicial,
  onEntrar,
}: {
  errorInicial?: string;
  onEntrar: () => void;
}) {
  const [vista, setVista] = useState<Vista>("login");
  const [email, setEmail] = useState("");
  const [nombre, setNombre] = useState("");
  const [password, setPassword] = useState("");
  const [repetida, setRepetida] = useState("");
  const [codigo, setCodigo] = useState("");
  const [error, setError] = useState<string | null>(errorInicial ?? null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  function ir(v: Vista) {
    setVista(v);
    setError(null);
    setAviso(null);
    setCodigo("");
  }

  // Ejecuta una acción mostrando "cargando" y los errores en pantalla.
  async function ejecutar(accion: () => Promise<void>) {
    setCargando(true);
    setError(null);
    setAviso(null);
    try {
      await accion();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCargando(false);
    }
  }

  // Tras iniciar sesión, decide a dónde ir según lo que pida Cognito.
  async function entrar(correo: string, clave: string) {
    const resultado = await iniciarSesion(correo, clave);
    if (resultado === "dentro") return onEntrar();
    if (resultado === "confirmar") {
      setAviso("Tu cuenta aún no está confirmada. Te hemos enviado un código por email.");
      setVista("confirmar");
    } else {
      setPassword("");
      setVista("cambiar");
    }
  }

  const enviarLogin = (e: FormEvent) => {
    e.preventDefault();
    ejecutar(() => entrar(email.trim(), password));
  };

  const enviarRegistro = (e: FormEvent) => {
    e.preventDefault();
    if (!passwordValida(password)) return setError("La contraseña no cumple todos los requisitos.");
    if (password !== repetida) return setError("Las contraseñas no coinciden.");
    ejecutar(async () => {
      await registrar(email.trim(), password, nombre.trim());
      setAviso(`Te hemos enviado un código de verificación a ${email.trim()}.`);
      setVista("confirmar");
    });
  };

  const enviarCodigo = (e: FormEvent) => {
    e.preventDefault();
    ejecutar(async () => {
      await confirmarRegistro(email.trim(), codigo);
      // Si acaba de registrarse, entra directamente; si no, vuelve al inicio de sesión.
      if (password) return entrar(email.trim(), password);
      setVista("login");
      setAviso("Cuenta confirmada. Ya puedes iniciar sesión.");
    });
  };

  const enviarRecuperar = (e: FormEvent) => {
    e.preventDefault();
    ejecutar(async () => {
      await pedirRecuperacion(email.trim());
      setPassword("");
      setRepetida("");
      setAviso(`Si existe una cuenta con ${email.trim()}, te hemos enviado un código.`);
      setVista("restablecer");
    });
  };

  const enviarRestablecer = (e: FormEvent) => {
    e.preventDefault();
    if (!passwordValida(password)) return setError("La contraseña no cumple todos los requisitos.");
    if (password !== repetida) return setError("Las contraseñas no coinciden.");
    ejecutar(async () => {
      await confirmarRecuperacion(email.trim(), codigo, password);
      await entrar(email.trim(), password);
    });
  };

  const enviarCambio = (e: FormEvent) => {
    e.preventDefault();
    if (!passwordValida(password)) return setError("La contraseña no cumple todos los requisitos.");
    ejecutar(async () => {
      await cambiarPasswordTemporal(password);
      onEntrar();
    });
  };

  const reenviar = () =>
    ejecutar(async () => {
      await reenviarCodigo(email.trim());
      setAviso("Código reenviado. Revisa también la carpeta de spam.");
    });

  const textos: Record<Vista, { titulo: string; subtitulo: string }> = {
    login: { titulo: "Bienvenido de nuevo", subtitulo: "Inicia sesión para continuar." },
    registro: { titulo: "Crea tu cuenta", subtitulo: "Empieza a generar documentos en minutos." },
    confirmar: { titulo: "Confirma tu email", subtitulo: "Introduce el código de 6 dígitos que te hemos enviado." },
    recuperar: { titulo: "Recupera tu contraseña", subtitulo: "Te enviaremos un código a tu email." },
    restablecer: { titulo: "Nueva contraseña", subtitulo: "Introduce el código y elige una contraseña nueva." },
    cambiar: { titulo: "Elige tu contraseña", subtitulo: "Tu cuenta tiene una contraseña temporal. Cámbiala para continuar." },
  };

  const enlace = (texto: string, destino: Vista) => (
    <button type="button" onClick={() => ir(destino)} className="font-medium text-indigo-600 hover:text-indigo-700">
      {texto}
    </button>
  );

  let formulario: ReactNode;
  if (vista === "login") {
    formulario = (
      <form onSubmit={enviarLogin} className="flex flex-col gap-4">
        <Campo etiqueta="Email" icono="mail" type="email" required autoComplete="email" placeholder="tu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Campo etiqueta="Contraseña" icono="candado" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <div className="-mt-1 text-right text-sm">{enlace("¿Has olvidado la contraseña?", "recuperar")}</div>
        <Boton type="submit" disabled={cargando} className="w-full py-2.5">{cargando ? "Entrando…" : "Iniciar sesión"}</Boton>
        <p className="text-center text-sm text-zinc-500">¿No tienes cuenta? {enlace("Regístrate", "registro")}</p>
      </form>
    );
  } else if (vista === "registro") {
    formulario = (
      <form onSubmit={enviarRegistro} className="flex flex-col gap-4">
        <Campo etiqueta="Nombre" icono="persona" required autoComplete="name" placeholder="Cómo quieres que te llamemos" maxLength={100} value={nombre} onChange={(e) => setNombre(e.target.value)} />
        <Campo etiqueta="Email" icono="mail" type="email" required autoComplete="email" placeholder="tu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Campo etiqueta="Contraseña" icono="candado" type="password" required autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <Requisitos password={password} />
        <Campo etiqueta="Repite la contraseña" icono="candado" type="password" required autoComplete="new-password" value={repetida} onChange={(e) => setRepetida(e.target.value)} />
        <Boton type="submit" disabled={cargando} className="w-full py-2.5">{cargando ? "Creando cuenta…" : "Crear cuenta"}</Boton>
        <p className="text-center text-sm text-zinc-500">¿Ya tienes cuenta? {enlace("Inicia sesión", "login")}</p>
      </form>
    );
  } else if (vista === "confirmar") {
    formulario = (
      <form onSubmit={enviarCodigo} className="flex flex-col gap-4">
        <Campo etiqueta="Código de verificación" icono="check" required inputMode="numeric" autoComplete="one-time-code" placeholder="123456" maxLength={6} value={codigo} onChange={(e) => setCodigo(e.target.value)} />
        <Boton type="submit" disabled={cargando} className="w-full py-2.5">{cargando ? "Comprobando…" : "Confirmar"}</Boton>
        <p className="text-center text-sm text-zinc-500">
          ¿No te ha llegado?{" "}
          <button type="button" onClick={reenviar} disabled={cargando} className="font-medium text-indigo-600 hover:text-indigo-700">Reenviar código</button>
        </p>
        <p className="text-center text-sm text-zinc-500">{enlace("Volver", "login")}</p>
      </form>
    );
  } else if (vista === "recuperar") {
    formulario = (
      <form onSubmit={enviarRecuperar} className="flex flex-col gap-4">
        <Campo etiqueta="Email" icono="mail" type="email" required autoComplete="email" placeholder="tu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Boton type="submit" disabled={cargando} className="w-full py-2.5">{cargando ? "Enviando…" : "Enviar código"}</Boton>
        <p className="text-center text-sm text-zinc-500">{enlace("Volver", "login")}</p>
      </form>
    );
  } else if (vista === "restablecer") {
    formulario = (
      <form onSubmit={enviarRestablecer} className="flex flex-col gap-4">
        <Campo etiqueta="Código" icono="check" required inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={codigo} onChange={(e) => setCodigo(e.target.value)} />
        <Campo etiqueta="Contraseña nueva" icono="candado" type="password" required autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <Requisitos password={password} />
        <Campo etiqueta="Repite la contraseña" icono="candado" type="password" required autoComplete="new-password" value={repetida} onChange={(e) => setRepetida(e.target.value)} />
        <Boton type="submit" disabled={cargando} className="w-full py-2.5">{cargando ? "Guardando…" : "Cambiar contraseña y entrar"}</Boton>
        <p className="text-center text-sm text-zinc-500">{enlace("Volver", "login")}</p>
      </form>
    );
  } else {
    formulario = (
      <form onSubmit={enviarCambio} className="flex flex-col gap-4">
        <Campo etiqueta="Contraseña nueva" icono="candado" type="password" required autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <Requisitos password={password} />
        <Boton type="submit" disabled={cargando} className="w-full py-2.5">{cargando ? "Guardando…" : "Guardar y entrar"}</Boton>
      </form>
    );
  }

  return (
    <div className="grid flex-1 lg:grid-cols-2">
      {/* Panel de marca (solo en pantallas anchas) */}
      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-indigo-600 via-violet-600 to-sky-500 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-sky-300/20 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <Logo className="h-10 w-10 bg-white/20 from-transparent to-transparent shadow-none ring-1 ring-white/30" />
          <span className="text-lg font-semibold">Rellenador de plantillas</span>
        </div>
        <div className="relative max-w-md">
          <h1 className="text-4xl font-bold leading-tight tracking-tight">Documentos listos en segundos, sin copiar y pegar.</h1>
          <p className="mt-4 text-lg text-indigo-100">
            Sube tu plantilla de Word, elige a la persona y descarga el documento ya relleno.
          </p>
          <ul className="mt-8 flex flex-col gap-3 text-indigo-50">
            <Ventaja texto="Tus plantillas y tus datos son solo tuyos" />
            <Ventaja texto="Los campos se detectan solos en tu Word" />
            <Ventaja texto="Historial de todo lo que has generado" />
          </ul>
        </div>
        <p className="relative text-sm text-indigo-100/80">Tus datos se guardan cifrados en AWS.</p>
      </aside>

      {/* Formulario */}
      <main className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <Logo />
            <span className="font-semibold">Rellenador de plantillas</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">{textos[vista].titulo}</h2>
          <p className="mt-1 mb-6 text-zinc-500">{textos[vista].subtitulo}</p>
          <div className="mb-4 flex flex-col gap-3">
            <Aviso mensaje={error} />
            <Aviso mensaje={aviso} tipo="info" />
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            {formulario}
          </div>
        </div>
      </main>
    </div>
  );
}
