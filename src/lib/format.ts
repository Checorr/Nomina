/**
 * Utilidades de formato para México, usadas en toda la interfaz de nómina.
 */

const moneyFormatter = new Intl.NumberFormat("es-MX", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Formatea un monto en pesos mexicanos, p. ej. `money(1234.5)` → `"$1,234.50"`.
 * Replica la función `money()` del prototipo de diseño: siempre antepone
 * "$" y usa exactamente dos decimales.
 */
export function money(n: number): string {
  return "$" + moneyFormatter.format(n);
}

/**
 * Iniciales a partir de las primeras dos palabras del nombre.
 * `initials("María Fernanda Rosales Gómez")` → `"MF"`.
 */
export function initials(nombre: string): string {
  return nombre
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((palabra) => palabra.charAt(0).toUpperCase())
    .join("");
}

/**
 * Primeras dos palabras del nombre, tal como aparecen.
 * `shortName("María Fernanda Rosales Gómez")` → `"María Fernanda"`.
 */
export function shortName(nombre: string): string {
  return nombre.trim().split(/\s+/).slice(0, 2).join(" ");
}

/**
 * Formatea una fecha como dd/mm/aaaa.
 */
export function fechaCorta(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const dia = String(date.getDate()).padStart(2, "0");
  const mes = String(date.getMonth() + 1).padStart(2, "0");
  const anio = date.getFullYear();
  return `${dia}/${mes}/${anio}`;
}

/**
 * Etiqueta de unidad de tarifa, tal como se muestra junto al monto.
 */
export function unidadLabel(u: "hora" | "dia"): string {
  return u === "hora" ? "/ hora" : "/ día";
}
