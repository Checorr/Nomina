/**
 * Helpers de formato exclusivos de la pestaña "Cierre de nómina".
 *
 * Igual que en `src/lib/format.ts`, las fechas se tratan como strings ISO
 * `aaaa-mm-dd` y se parsean a mano (sin `Date`) para no meter desfases de
 * zona horaria.
 */

import type { Unidad } from "@/lib/contracts";
import { money } from "@/lib/format";

/** Signo menos tipográfico (U+2212), no un guion. */
export const MINUS = "−";

const MESES = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];

function parseISODate(fecha: string): { dia: number; mes: number; anio: number } {
  const [anio, mes, dia] = fecha.split("-").map(Number);
  return { dia, mes: mes - 1, anio };
}

/**
 * Formatea el rango de un periodo semanal, p. ej. `rangoSemana(...)` →
 * `"24 – 30 ago"` (mismo mes) o `"29 jul – 4 ago"` (cruza de mes). Usa el
 * en dash "–", no un guion simple.
 */
export function rangoSemana(periodo: { fechaInicio: string; fechaFin: string }): string {
  const inicio = parseISODate(periodo.fechaInicio);
  const fin = parseISODate(periodo.fechaFin);
  if (inicio.mes === fin.mes && inicio.anio === fin.anio) {
    return `${inicio.dia} – ${fin.dia} ${MESES[fin.mes]}`;
  }
  return `${inicio.dia} ${MESES[inicio.mes]} – ${fin.dia} ${MESES[fin.mes]}`;
}

/** Recorta decimales en .0, deja el resto con un decimal. */
export function formatCantidad(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

/** "36.0 h" o "6 d", según la unidad de la tarifa del empleado. */
export function tiempoLabel(cantidad: number, unidad: Unidad): string {
  return unidad === "hora" ? `${cantidad.toFixed(1)} h` : `${formatCantidad(cantidad)} d`;
}

/** "$62.00/h" o "$480.00/d". */
export function tarifaLabel(tarifa: number, unidad: Unidad): string {
  return `${money(tarifa)}${unidad === "hora" ? "/h" : "/d"}`;
}

/** "—" cuando el monto es 0; si no, "+ $150.00". */
export function bonoLabel(n: number): string {
  return n ? `+ ${money(n)}` : "—";
}

/** "—" cuando el monto es 0; si no, "− $250.00" (con signo menos U+2212). */
export function descuentoLabel(n: number): string {
  return n ? `${MINUS} ${money(n)}` : "—";
}

/** Singular/plural: "1 empleado tiene checadas incompletas esta semana. Verifica antes de cerrar." */
export function alertaIncompletasTexto(n: number): string {
  const sujeto = n === 1 ? "empleado tiene" : "empleados tienen";
  return `${n} ${sujeto} checadas incompletas esta semana. Verifica antes de cerrar.`;
}

/** "1 empleado" / "12 empleados". */
export function pluralEmpleados(n: number): string {
  return `${n} ${n === 1 ? "empleado" : "empleados"}`;
}
