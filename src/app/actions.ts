"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { empleados, historialTarifas, periodos, recibos, tarjetas } from "@/db/schema";
import { calcularNomina } from "@/lib/queries";
import type { ActionResult, NuevoEmpleado, Unidad } from "@/lib/contracts";

// TODO: no existe todavía un sistema de usuarios/autenticación; en cuanto
// exista, sustituir esta constante por el usuario de la sesión actual.
const AUTOR_ACTUAL = "admin";

// Nota sobre transacciones: el driver HTTP de Neon (`neon-http`) no soporta
// `db.transaction()` (lanza "No transactions support in neon-http driver").
// Cuando dos o más escrituras deben ser atómicas usamos `db.batch()`, que en
// este driver sí viaja como una transacción real del lado de Neon.

function esFechaIsoValida(fecha: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return false;
  const d = new Date(`${fecha}T00:00:00Z`);
  return !Number.isNaN(d.getTime());
}

// ---------------------------------------------------------------------------
// actualizarTarifa
// ---------------------------------------------------------------------------

export async function actualizarTarifa(
  empleadoId: number,
  tarifa: number,
  unidad: Unidad,
): Promise<ActionResult> {
  try {
    if (!Number.isFinite(tarifa) || tarifa <= 0) {
      return { ok: false, error: "La tarifa debe ser un número mayor a 0." };
    }
    if (unidad !== "hora" && unidad !== "dia") {
      return { ok: false, error: "La unidad debe ser 'hora' o 'dia'." };
    }

    const [empleado] = await db
      .select()
      .from(empleados)
      .where(eq(empleados.id, empleadoId))
      .limit(1);
    if (!empleado) {
      return { ok: false, error: "El empleado no existe." };
    }

    const tarifaTexto = tarifa.toFixed(2);

    await db.batch([
      db
        .update(empleados)
        .set({ tarifa: tarifaTexto, unidad, actualizadoEn: new Date() })
        .where(eq(empleados.id, empleadoId)),
      db.insert(historialTarifas).values({
        empleadoId,
        tarifaAnterior: empleado.tarifa,
        unidadAnterior: empleado.unidad,
        tarifaNueva: tarifaTexto,
        unidadNueva: unidad,
        autor: AUTOR_ACTUAL,
      }),
    ]);

    revalidatePath("/");
    return { ok: true, data: undefined };
  } catch {
    return { ok: false, error: "No se pudo actualizar la tarifa. Intenta de nuevo." };
  }
}

// ---------------------------------------------------------------------------
// crearEmpleado
// ---------------------------------------------------------------------------

export async function crearEmpleado(
  input: NuevoEmpleado,
): Promise<ActionResult<{ id: number }>> {
  try {
    const nombre = input.nombre?.trim();
    const puesto = input.puesto?.trim();

    if (!nombre) return { ok: false, error: "El nombre es obligatorio." };
    if (!puesto) return { ok: false, error: "El puesto es obligatorio." };
    if (!Number.isFinite(input.tarifa) || input.tarifa <= 0) {
      return { ok: false, error: "La tarifa debe ser un número mayor a 0." };
    }
    if (input.unidad !== "hora" && input.unidad !== "dia") {
      return { ok: false, error: "La unidad debe ser 'hora' o 'dia'." };
    }
    if (!input.fechaIngreso || !esFechaIsoValida(input.fechaIngreso)) {
      return { ok: false, error: "La fecha de ingreso no es válida." };
    }

    const uid = input.uid?.trim() || null;
    if (uid) {
      const [existente] = await db.select().from(tarjetas).where(eq(tarjetas.uid, uid)).limit(1);
      if (existente) {
        return {
          ok: false,
          error: "Esa tarjeta ya está registrada en el sistema; no se puede usar para un alta.",
        };
      }
    }

    // Reservamos el id antes de escribir: el driver HTTP de Neon no permite
    // encadenar el id generado por un INSERT hacia otras sentencias dentro
    // del mismo batch, así que lo obtenemos de la secuencia y lo fijamos
    // explícitamente en las 2 o 3 filas que se insertan de forma atómica.
    const idRows = (
      await db.execute<{ id: string }>(
        sql`select nextval(pg_get_serial_sequence('empleados', 'id')) as id`,
      )
    ).rows;
    const nuevoId = Number(idRows[0]?.id);
    if (!Number.isFinite(nuevoId)) {
      return { ok: false, error: "No se pudo generar el identificador del empleado." };
    }

    const tarifaTexto = input.tarifa.toFixed(2);

    const insertarEmpleado = db.insert(empleados).values({
      id: nuevoId,
      nombre,
      puesto,
      tarifa: tarifaTexto,
      unidad: input.unidad,
      fechaIngreso: input.fechaIngreso,
      activo: true,
    });
    const insertarHistorial = db.insert(historialTarifas).values({
      empleadoId: nuevoId,
      tarifaAnterior: null,
      unidadAnterior: null,
      tarifaNueva: tarifaTexto,
      unidadNueva: input.unidad,
      autor: AUTOR_ACTUAL,
    });

    if (uid) {
      await db.batch([
        insertarEmpleado,
        insertarHistorial,
        db.insert(tarjetas).values({ uid, empleadoId: nuevoId, activa: true }),
      ]);
    } else {
      await db.batch([insertarEmpleado, insertarHistorial]);
    }

    revalidatePath("/");
    return { ok: true, data: { id: nuevoId } };
  } catch {
    return { ok: false, error: "No se pudo crear el empleado. Intenta de nuevo." };
  }
}

// ---------------------------------------------------------------------------
// darDeBaja
// ---------------------------------------------------------------------------

export async function darDeBaja(empleadoId: number): Promise<ActionResult> {
  try {
    const [empleado] = await db
      .select()
      .from(empleados)
      .where(eq(empleados.id, empleadoId))
      .limit(1);
    if (!empleado) {
      return { ok: false, error: "El empleado no existe." };
    }
    if (!empleado.activo) {
      return { ok: false, error: "El empleado ya está dado de baja." };
    }

    const hoy = new Date().toISOString().slice(0, 10);

    await db.batch([
      db
        .update(empleados)
        .set({ activo: false, fechaBaja: hoy, actualizadoEn: new Date() })
        .where(eq(empleados.id, empleadoId)),
      db
        .update(tarjetas)
        .set({ activa: false, liberadaEn: new Date() })
        .where(and(eq(tarjetas.empleadoId, empleadoId), eq(tarjetas.activa, true))),
    ]);

    revalidatePath("/");
    return { ok: true, data: undefined };
  } catch {
    return { ok: false, error: "No se pudo dar de baja al empleado. Intenta de nuevo." };
  }
}

// ---------------------------------------------------------------------------
// vincularTarjeta
// ---------------------------------------------------------------------------

export async function vincularTarjeta(empleadoId: number, uid: string): Promise<ActionResult> {
  try {
    const uidLimpio = uid?.trim();
    if (!uidLimpio) {
      return { ok: false, error: "El UID de la tarjeta es obligatorio." };
    }

    const [empleado] = await db
      .select()
      .from(empleados)
      .where(eq(empleados.id, empleadoId))
      .limit(1);
    if (!empleado) {
      return { ok: false, error: "El empleado no existe." };
    }

    // uid es único en toda la tabla `tarjetas` (activas e inactivas), así que
    // una tarjeta liberada de un empleado anterior se reutiliza actualizando
    // su fila en vez de insertar una nueva.
    const [tarjetaExistente] = await db
      .select()
      .from(tarjetas)
      .where(eq(tarjetas.uid, uidLimpio))
      .limit(1);

    if (tarjetaExistente?.activa) {
      if (tarjetaExistente.empleadoId === empleadoId) {
        return { ok: false, error: "Esa tarjeta ya está vinculada a este empleado." };
      }
      return { ok: false, error: "Esa tarjeta ya está vinculada a otro empleado." };
    }

    const liberarTarjetaActual = db
      .update(tarjetas)
      .set({ activa: false, liberadaEn: new Date() })
      .where(and(eq(tarjetas.empleadoId, empleadoId), eq(tarjetas.activa, true)));

    if (tarjetaExistente) {
      await db.batch([
        liberarTarjetaActual,
        db
          .update(tarjetas)
          .set({ empleadoId, activa: true, asignadaEn: new Date(), liberadaEn: null })
          .where(eq(tarjetas.id, tarjetaExistente.id)),
      ]);
    } else {
      await db.batch([
        liberarTarjetaActual,
        db.insert(tarjetas).values({ uid: uidLimpio, empleadoId, activa: true }),
      ]);
    }

    revalidatePath("/");
    return { ok: true, data: undefined };
  } catch {
    return { ok: false, error: "No se pudo vincular la tarjeta. Intenta de nuevo." };
  }
}

// ---------------------------------------------------------------------------
// cerrarPeriodo
// ---------------------------------------------------------------------------

export async function cerrarPeriodo(periodoId: number): Promise<ActionResult> {
  try {
    const [periodo] = await db.select().from(periodos).where(eq(periodos.id, periodoId)).limit(1);
    if (!periodo) {
      return { ok: false, error: "El periodo no existe." };
    }
    if (periodo.estado !== "abierto") {
      return { ok: false, error: "El periodo ya está cerrado." };
    }

    const nomina = await calcularNomina(periodoId);

    const insertarRecibos = nomina.filas.map((fila) =>
      db.insert(recibos).values({
        empleadoId: fila.empleadoId,
        periodoId,
        tarifaSnapshot: fila.tarifa.toFixed(2),
        unidadSnapshot: fila.unidad,
        cantidad: fila.cantidad.toString(),
        sueldo: fila.sueldo.toFixed(2),
        bonos: fila.bonos.toFixed(2),
        descuentos: fila.descuentos.toFixed(2),
        neto: fila.neto.toFixed(2),
      }),
    );

    const actualizarPeriodo = db
      .update(periodos)
      .set({ estado: "cerrado", cerradoEn: new Date() })
      .where(eq(periodos.id, periodoId));

    await db.batch([actualizarPeriodo, ...insertarRecibos]);

    revalidatePath("/");
    return { ok: true, data: undefined };
  } catch {
    return { ok: false, error: "No se pudo cerrar el periodo. Intenta de nuevo." };
  }
}
