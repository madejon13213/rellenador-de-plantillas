import { Amplify } from "aws-amplify";
import {
  confirmResetPassword,
  confirmSignIn,
  confirmSignUp,
  fetchAuthSession,
  resendSignUpCode,
  resetPassword,
  signIn,
  signOut,
  signUp,
} from "aws-amplify/auth";

const USER_POOL_ID = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID;
const CLIENT_ID = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID;

let configurado = false;

// Se llama desde el navegador. Es seguro llamarla varias veces.
export function configurarAuth() {
  if (configurado) return;
  if (!USER_POOL_ID || !CLIENT_ID) {
    throw new Error(
      "Faltan NEXT_PUBLIC_COGNITO_USER_POOL_ID o NEXT_PUBLIC_COGNITO_CLIENT_ID en frontend/.env.local",
    );
  }
  Amplify.configure({
    Auth: { Cognito: { userPoolId: USER_POOL_ID, userPoolClientId: CLIENT_ID } },
  });
  configurado = true;
}

// Traduce los errores de Cognito a mensajes claros en español.
function traducir(e: unknown): Error {
  const nombre = e instanceof Error ? e.name : "";
  const mensajes: Record<string, string> = {
    NotAuthorizedException: "El email o la contraseña no son correctos.",
    UserNotFoundException: "El email o la contraseña no son correctos.",
    UsernameExistsException: "Ya existe una cuenta con ese email. Prueba a iniciar sesión.",
    InvalidPasswordException:
      "La contraseña no cumple los requisitos: 12 caracteres o más, con mayúscula, minúscula, número y símbolo.",
    CodeMismatchException: "El código no es correcto.",
    ExpiredCodeException: "El código ha caducado. Pide uno nuevo.",
    LimitExceededException: "Demasiados intentos. Espera unos minutos y vuelve a probar.",
    TooManyRequestsException: "Demasiados intentos. Espera unos minutos y vuelve a probar.",
    InvalidParameterException: "Alguno de los datos no es válido. Revísalos e inténtalo de nuevo.",
    NetworkError: "No se pudo conectar. Comprueba tu conexión.",
  };
  return new Error(mensajes[nombre] ?? (e instanceof Error ? e.message : "Ha ocurrido un error."));
}

export type Sesion = { email: string; nombre: string };

// Datos de la cuenta con sesión iniciada, o null si no la hay.
export async function usuarioActual(): Promise<Sesion | null> {
  configurarAuth();
  try {
    const { tokens } = await fetchAuthSession();
    if (!tokens?.idToken) return null;
    const p = tokens.idToken.payload;
    const email = String(p.email ?? "");
    const nombre = String(p.name ?? "").trim() || email.split("@")[0];
    return { email, nombre };
  } catch {
    return null;
  }
}

export type ResultadoAcceso = "dentro" | "confirmar" | "cambiar-password";

export async function iniciarSesion(email: string, password: string): Promise<ResultadoAcceso> {
  configurarAuth();
  try {
    const r = await signIn({ username: email, password });
    if (r.isSignedIn) return "dentro";
    switch (r.nextStep.signInStep) {
      case "CONFIRM_SIGN_UP":
        await resendSignUpCode({ username: email });
        return "confirmar";
      case "CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED":
        return "cambiar-password";
      default:
        throw new Error("Este tipo de acceso todavía no está disponible.");
    }
  } catch (e) {
    const nombre = e instanceof Error ? e.name : "";
    if (nombre === "UserAlreadyAuthenticatedException") return "dentro";
    if (nombre === "UserNotConfirmedException") {
      await resendSignUpCode({ username: email });
      return "confirmar";
    }
    throw traducir(e);
  }
}

// Cuentas creadas por el administrador con contraseña temporal.
export async function cambiarPasswordTemporal(nueva: string) {
  try {
    await confirmSignIn({ challengeResponse: nueva });
  } catch (e) {
    throw traducir(e);
  }
}

export async function registrar(email: string, password: string, nombre: string) {
  configurarAuth();
  try {
    await signUp({
      username: email,
      password,
      options: { userAttributes: { email, ...(nombre ? { name: nombre } : {}) } },
    });
  } catch (e) {
    throw traducir(e);
  }
}

export async function confirmarRegistro(email: string, codigo: string) {
  configurarAuth();
  try {
    await confirmSignUp({ username: email, confirmationCode: codigo.trim() });
  } catch (e) {
    throw traducir(e);
  }
}

export async function reenviarCodigo(email: string) {
  configurarAuth();
  try {
    await resendSignUpCode({ username: email });
  } catch (e) {
    throw traducir(e);
  }
}

export async function pedirRecuperacion(email: string) {
  configurarAuth();
  try {
    await resetPassword({ username: email });
  } catch (e) {
    throw traducir(e);
  }
}

export async function confirmarRecuperacion(email: string, codigo: string, nueva: string) {
  configurarAuth();
  try {
    await confirmResetPassword({ username: email, confirmationCode: codigo.trim(), newPassword: nueva });
  } catch (e) {
    throw traducir(e);
  }
}

export async function cerrarSesion() {
  configurarAuth();
  await signOut();
}

// Token de acceso (JWT) que API Gateway valida en cada petición. Amplify lo renueva si ha caducado.
export async function tokenDeAcceso(): Promise<string | null> {
  configurarAuth();
  const { tokens } = await fetchAuthSession();
  return tokens?.accessToken.toString() ?? null;
}
