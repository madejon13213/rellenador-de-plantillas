import { Amplify } from "aws-amplify";
import { fetchAuthSession, getCurrentUser, signInWithRedirect, signOut } from "aws-amplify/auth";

const USER_POOL_ID = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID;
const CLIENT_ID = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID;
const DOMINIO = process.env.NEXT_PUBLIC_COGNITO_DOMAIN;

let configurado = false;

// Se llama desde el navegador (necesita window). Es seguro llamarla varias veces.
export function configurarAuth() {
  if (configurado) return;
  if (!USER_POOL_ID || !CLIENT_ID || !DOMINIO) {
    throw new Error(
      "Faltan NEXT_PUBLIC_COGNITO_USER_POOL_ID, NEXT_PUBLIC_COGNITO_CLIENT_ID o NEXT_PUBLIC_COGNITO_DOMAIN en frontend/.env.local",
    );
  }

  // Cognito devuelve al usuario a esta misma web: debe coincidir con las direcciones
  // registradas en el cliente (infra/auth.tf), incluida la barra final.
  const retorno = `${window.location.origin}/`;

  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId: USER_POOL_ID,
        userPoolClientId: CLIENT_ID,
        loginWith: {
          oauth: {
            domain: DOMINIO,
            scopes: ["openid", "email"],
            redirectSignIn: [retorno],
            redirectSignOut: [retorno],
            responseType: "code",
          },
        },
      },
    },
  });
  configurado = true;
}

// Devuelve el email del usuario con sesión iniciada, o null si no la hay.
export async function usuarioActual(): Promise<string | null> {
  configurarAuth();
  try {
    // Espera a que termine el intercambio del código si el usuario acaba de volver del login.
    const { tokens } = await fetchAuthSession();
    if (!tokens) return null;
    const usuario = await getCurrentUser();
    return String(tokens.idToken?.payload.email ?? usuario.username);
  } catch {
    return null;
  }
}

export function iniciarSesion() {
  configurarAuth();
  return signInWithRedirect();
}

export function cerrarSesion() {
  configurarAuth();
  return signOut();
}

// Token de acceso (JWT) que API Gateway valida en cada petición. Amplify lo renueva si ha caducado.
export async function tokenDeAcceso(): Promise<string | null> {
  configurarAuth();
  const { tokens } = await fetchAuthSession();
  return tokens?.accessToken.toString() ?? null;
}
