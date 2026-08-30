/**
 * Utilidades compartidas de vinculación de tarjetas NFC para la pestaña
 * Personal (alta de empleado y ficha de empleado).
 */

/**
 * Genera un UID de tarjeta simulado, con el mismo formato visual que el
 * prototipo ("E1 4B 08 9D"): 4 bytes en hexadecimal mayúsculas separados
 * por espacio.
 *
 * TODO: sustituir por la lectura real de una tarjeta vía Web NFC API
 * (`NDEFReader`) en cuanto haya un lector NFC conectado a la tablet de
 * recepción. Hoy no existe lector conectado, así que el flujo de UI ofrece
 * un botón de "simular lectura" en su lugar.
 */
export function generarUidSimulado(): string {
  return Array.from({ length: 4 }, () =>
    Math.floor(Math.random() * 256)
      .toString(16)
      .toUpperCase()
      .padStart(2, "0"),
  ).join(" ");
}
