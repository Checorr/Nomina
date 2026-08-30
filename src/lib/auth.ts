/**
 * Autenticación con contraseña única compartida.
 *
 * `verificarPassword` usa `node:crypto` (scrypt + comparación en tiempo
 * constante) y por lo tanto SOLO puede importarse desde código que corre en
 * runtime Node.js (Server Actions, Route Handlers, Server Components). NO la
 * importes desde `proxy.ts`: ese archivo corre en Edge runtime en Next.js
 * (heredado del extinto `middleware.ts`; ver nota en `proxy.ts`) y `node:crypto`
 * no está disponible ahí.
 *
 * `crearSesion` / `verificarSesion` usan `jose`, que sí es compatible con
 * Edge y Node.js, por lo que pueden importarse tanto desde Server Actions
 * como desde `proxy.ts`.
 */
import { scrypt, randomBytes, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { SignJWT, jwtVerify } from "jose";

const scryptAsync = promisify(scrypt);

export const NOMBRE_COOKIE_SESION = "nomina_sesion";
export const DURACION_SESION_SEGUNDOS = 60 * 60 * 24 * 7; // 7 días

const KEYLEN = 64;

function obtenerSecretoSesion(): Uint8Array {
  const secreto = process.env.SESSION_SECRET;
  if (!secreto) {
    throw new Error(
      "SESSION_SECRET no está configurado. Define esta variable en .env.local (y en Vercel) antes de iniciar sesión."
    );
  }
  return new TextEncoder().encode(secreto);
}

/**
 * Compara una contraseña en texto plano contra el hash scrypt almacenado en
 * `APP_PASSWORD_HASH` (formato "salt:hash", ambos en hex). Comparación en
 * tiempo constante vía `timingSafeEqual`.
 *
 * Si `APP_PASSWORD_HASH` está vacío o ausente, siempre devuelve `false` y
 * registra una advertencia — nunca se deja pasar por defecto.
 */
export async function verificarPassword(plano: string): Promise<boolean> {
  const hashGuardado = process.env.APP_PASSWORD_HASH;

  if (!hashGuardado) {
    console.warn(
      "[auth] APP_PASSWORD_HASH no está configurado. Ningún login será " +
        "aceptado hasta que corras `npm run set-password` para fijar la " +
        "contraseña de acceso."
    );
    return false;
  }

  const [saltHex, hashHex] = hashGuardado.split(":");
  if (!saltHex || !hashHex) {
    console.warn(
      "[auth] APP_PASSWORD_HASH tiene un formato inválido. Vuelve a correr " +
        "`npm run set-password`."
    );
    return false;
  }

  const salt = Buffer.from(saltHex, "hex");
  const hashGuardadoBuf = Buffer.from(hashHex, "hex");

  const hashCalculado = (await scryptAsync(
    plano,
    salt,
    hashGuardadoBuf.length || KEYLEN
  )) as Buffer;

  if (hashCalculado.length !== hashGuardadoBuf.length) {
    return false;
  }

  return timingSafeEqual(hashCalculado, hashGuardadoBuf);
}

/** Crea un JWT (HS256) firmado con SESSION_SECRET, válido por 7 días. */
export async function crearSesion(): Promise<string> {
  const secreto = obtenerSecretoSesion();
  return new SignJWT({ tipo: "nomina_sesion" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${DURACION_SESION_SEGUNDOS}s`)
    .sign(secreto);
}

/** Verifica que el token de sesión sea un JWT válido, firmado y no expirado. */
export async function verificarSesion(
  token: string | undefined
): Promise<boolean> {
  if (!token) return false;

  try {
    const secreto = obtenerSecretoSesion();
    await jwtVerify(token, secreto);
    return true;
  } catch {
    return false;
  }
}

/** Flags de cookie compartidos entre la Server Action y cualquier lugar que la lea. */
export function opcionesCookieSesion() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DURACION_SESION_SEGUNDOS,
  };
}
