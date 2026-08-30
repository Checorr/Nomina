import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { NOMBRE_COOKIE_SESION, verificarSesion } from "@/lib/auth";

/**
 * NOTA — por qué este archivo se llama `proxy.ts` y no `middleware.ts`:
 *
 * La tarea original pedía crear `middleware.ts`. Next.js 16 deprecó esa
 * convención y la renombró a `proxy.ts` (mismo comportamiento, solo cambia
 * el nombre del archivo y de la función exportada) — ver
 * `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`.
 * `next build` emite una advertencia si detecta `middleware.ts`, así que se
 * usa aquí la convención vigente en vez de la deprecada. Si algún otro
 * agente o script espera un archivo `middleware.ts`, avisar: en Next 16
 * ambos archivos no pueden coexistir (el build falla si los detecta a la vez).
 *
 * Este proxy protege TODA la app salvo `/login`, los assets internos de
 * Next (`_next/*`), `/favicon.ico` y archivos estáticos con extensión.
 * Sin la cookie `nomina_sesion` válida, redirige a `/login`.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const token = request.cookies.get(NOMBRE_COOKIE_SESION)?.value;
  const sesionValida = await verificarSesion(token);

  if (sesionValida) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", request.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    /*
     * Excluye del proxy:
     * - /login (la propia pantalla de acceso)
     * - _next/static, _next/image (assets internos de Next.js)
     * - favicon.ico
     * - cualquier archivo con extensión en /public (imágenes, fuentes, etc.)
     *
     * Excepción futura documentada (NO activar todavía): la ruta
     * `/api/kiosco` (checador NFC) se autenticará con un token de
     * dispositivo propio, no con la cookie de sesión de esta app. Cuando
     * exista, añadir algo como:
     *   '/((?!login|api/kiosco|_next/static|_next/image|favicon.ico|.*\\..*).*)'
     * en vez del patrón de abajo. Mientras tanto NO excluir /api/kiosco:
     * si la ruta se crea antes de implementar su propia autenticación,
     * debe quedar protegida por esta cookie como cualquier otra ruta.
     */
    "/((?!login|_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};
