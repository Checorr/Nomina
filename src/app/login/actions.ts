"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  crearSesion,
  NOMBRE_COOKIE_SESION,
  opcionesCookieSesion,
  verificarPassword,
} from "@/lib/auth";

const MAX_INTENTOS = 5;
const VENTANA_MS = 15 * 60 * 1000; // 15 minutos

/**
 * Rate limiting en memoria, por IP, de intentos fallidos de login.
 *
 * IMPORTANTE — limitación conocida: en Vercel (funciones serverless) cada
 * invocación puede aterrizar en una instancia distinta, y esta memoria no se
 * comparte entre instancias ni sobrevive un "cold start". En la práctica esto
 * significa que el límite es "mejor que nada" pero no estrictamente global:
 * un atacante distribuido o con mala suerte de scheduling puede obtener más
 * de 5 intentos reales. Para una garantía real en producción, este contador
 * debe moverse a la base de datos (una tabla `intentos_login`) o a un
 * almacén compartido tipo Vercel KV / Upstash Redis.
 */
const intentosPorIp = new Map<string, { intentos: number; desde: number }>();

function limpiarSiExpiro(ip: string) {
  const registro = intentosPorIp.get(ip);
  if (registro && Date.now() - registro.desde > VENTANA_MS) {
    intentosPorIp.delete(ip);
  }
}

function registrarIntentoFallido(ip: string) {
  limpiarSiExpiro(ip);
  const registro = intentosPorIp.get(ip);
  if (registro) {
    registro.intentos += 1;
  } else {
    intentosPorIp.set(ip, { intentos: 1, desde: Date.now() });
  }
}

function estaBloqueada(ip: string): boolean {
  limpiarSiExpiro(ip);
  const registro = intentosPorIp.get(ip);
  return !!registro && registro.intentos >= MAX_INTENTOS;
}

function limpiarIntentos(ip: string) {
  intentosPorIp.delete(ip);
}

async function obtenerIp(): Promise<string> {
  const headersList = await headers();
  // x-forwarded-for puede traer una lista "cliente, proxy1, proxy2"; el
  // primer valor es el más cercano al cliente original.
  const forwardedFor = headersList.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]!.trim();
  }
  const realIp = headersList.get("x-real-ip");
  if (realIp) return realIp;
  return "desconocida";
}

export type EstadoLogin = {
  error?: string;
};

export async function iniciarSesion(
  _estadoPrevio: EstadoLogin,
  formData: FormData
): Promise<EstadoLogin> {
  const password = formData.get("password");

  if (typeof password !== "string" || password.length === 0) {
    return { error: "Contraseña incorrecta." };
  }

  const ip = await obtenerIp();

  if (estaBloqueada(ip)) {
    return {
      error:
        "Demasiados intentos fallidos. Espera unos minutos antes de volver a intentar.",
    };
  }

  const esValida = await verificarPassword(password);

  if (!esValida) {
    registrarIntentoFallido(ip);
    return { error: "Contraseña incorrecta." };
  }

  limpiarIntentos(ip);

  const token = await crearSesion();
  const cookieStore = await cookies();
  cookieStore.set(NOMBRE_COOKIE_SESION, token, opcionesCookieSesion());

  redirect("/");
}

export async function cerrarSesion(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(NOMBRE_COOKIE_SESION);
  redirect("/login");
}
