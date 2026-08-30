import { and, asc, desc, eq, gte, lte, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  checadas,
  conceptos,
  empleados,
  historialTarifas,
  jornadas,
  periodos,
  tarjetas,
} from "@/db/schema";
import type {
  CambioTarifa,
  ConceptoRow,
  DiaAsistencia,
  EmpleadoDetalle,
  EmpleadoRow,
  EstadoJornada,
  NominaPeriodo,
  PeriodoRow,
  ReciboCalculado,
  SemanaAsistencia,
  Unidad,
} from "@/lib/contracts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MESES_ES = [
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

/** Redondea a 2 decimales, evitando arrastrar errores de punto flotante. */
function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Redondea a 1 decimal (usado solo para `cantidad` en unidad "hora"). */
function round1(n: number): number {
  return Math.round((n + Number.EPSILON) * 10) / 10;
}

/** Convierte un valor numeric (string) que puede venir null a number. */
function toNumber(v: string | null): number | null {
  return v === null ? null : Number(v);
}

/** Un timestamp que Drizzle ya devolvió como `Date` -> ISO 8601 string. */
function fechaAIso(d: Date | null): string | null {
  return d ? d.toISOString() : null;
}

/** Un timestamp -> string ISO `aaaa-mm-dd` (fecha calendario en UTC). */
function fechaADiaIso(d: Date | null): string {
  return (d ?? new Date(0)).toISOString().slice(0, 10);
}

/** Lunes (00:00 UTC) de la semana calendario a la que pertenece `d`. */
function lunesDeSemana(d: Date): Date {
  const utcDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = utcDay.getUTCDay(); // 0 = domingo ... 6 = sábado
  const diff = dow === 0 ? -6 : 1 - dow;
  utcDay.setUTCDate(utcDay.getUTCDate() + diff);
  return utcDay;
}

function sumarDias(d: Date, dias: number): Date {
  const copia = new Date(d);
  copia.setUTCDate(copia.getUTCDate() + dias);
  return copia;
}

function toIsoDia(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function etiquetaSemana(inicio: Date): string {
  return `${inicio.getUTCDate()} ${MESES_ES[inicio.getUTCMonth()]}`;
}

function mapPeriodo(row: typeof periodos.$inferSelect): PeriodoRow {
  return {
    id: row.id,
    fechaInicio: row.fechaInicio,
    fechaFin: row.fechaFin,
    estado: row.estado,
  };
}

// ---------------------------------------------------------------------------
// listarEmpleados
// ---------------------------------------------------------------------------

export async function listarEmpleados(): Promise<EmpleadoRow[]> {
  const ultimaChecadaSq = db
    .select({
      empleadoId: checadas.empleadoId,
      ultima: sql<string>`max(${checadas.marcadaEn})`.as("ultima"),
    })
    .from(checadas)
    .groupBy(checadas.empleadoId)
    .as("ultima_checada");

  const rows = await db
    .select({
      id: empleados.id,
      nombre: empleados.nombre,
      puesto: empleados.puesto,
      tarifa: empleados.tarifa,
      unidad: empleados.unidad,
      fechaIngreso: empleados.fechaIngreso,
      activo: empleados.activo,
      fotoUrl: empleados.fotoUrl,
      uid: tarjetas.uid,
      ultimaChecada: ultimaChecadaSq.ultima,
    })
    .from(empleados)
    .leftJoin(tarjetas, and(eq(tarjetas.empleadoId, empleados.id), eq(tarjetas.activa, true)))
    .leftJoin(ultimaChecadaSq, eq(ultimaChecadaSq.empleadoId, empleados.id))
    .orderBy(asc(empleados.nombre));

  return rows.map((r) => ({
    id: r.id,
    nombre: r.nombre,
    puesto: r.puesto,
    tarifa: Number(r.tarifa),
    unidad: r.unidad,
    fechaIngreso: r.fechaIngreso,
    activo: r.activo,
    fotoUrl: r.fotoUrl,
    uid: r.uid ?? null,
    ultimaChecada: r.ultimaChecada ? new Date(r.ultimaChecada).toISOString() : null,
  }));
}

// ---------------------------------------------------------------------------
// obtenerEmpleado
// ---------------------------------------------------------------------------

export async function obtenerEmpleado(id: number): Promise<EmpleadoDetalle | null> {
  const empRows = await db
    .select({
      id: empleados.id,
      nombre: empleados.nombre,
      puesto: empleados.puesto,
      tarifa: empleados.tarifa,
      unidad: empleados.unidad,
      fechaIngreso: empleados.fechaIngreso,
      activo: empleados.activo,
      fotoUrl: empleados.fotoUrl,
      fechaBaja: empleados.fechaBaja,
      uid: tarjetas.uid,
      tarjetaAsignadaEn: tarjetas.asignadaEn,
    })
    .from(empleados)
    .leftJoin(tarjetas, and(eq(tarjetas.empleadoId, empleados.id), eq(tarjetas.activa, true)))
    .where(eq(empleados.id, id))
    .limit(1);

  const emp = empRows[0];
  if (!emp) return null;

  const [ultimaRow] = await db
    .select({ ultima: sql<string | null>`max(${checadas.marcadaEn})` })
    .from(checadas)
    .where(eq(checadas.empleadoId, id));
  const ultimaChecada = ultimaRow?.ultima ? new Date(ultimaRow.ultima).toISOString() : null;

  const historialRows = await db
    .select()
    .from(historialTarifas)
    .where(eq(historialTarifas.empleadoId, id))
    .orderBy(desc(historialTarifas.creadoEn));

  const historial: CambioTarifa[] = historialRows.map((h) => ({
    fecha: fechaADiaIso(h.creadoEn),
    anterior: toNumber(h.tarifaAnterior),
    unidadAnterior: (h.unidadAnterior as Unidad | null) ?? null,
    nueva: Number(h.tarifaNueva),
    unidadNueva: h.unidadNueva as Unidad,
    autor: h.autor,
  }));

  const conceptoRows = await db
    .select()
    .from(conceptos)
    .where(and(eq(conceptos.empleadoId, id), eq(conceptos.recurrente, true)))
    .orderBy(asc(conceptos.id));

  const conceptosOut: ConceptoRow[] = conceptoRows.map((c) => ({
    id: c.id,
    tipo: c.tipo,
    descripcion: c.descripcion,
    monto: Number(c.monto),
    recurrente: c.recurrente,
    saldoRestante: toNumber(c.saldoRestante),
  }));

  // Últimas 4 semanas (lunes a domingo), de la más antigua a la más reciente.
  const lunesActual = lunesDeSemana(new Date());
  const rangosSemana = [3, 2, 1, 0].map((semanasAtras) => {
    const inicio = sumarDias(lunesActual, -7 * semanasAtras);
    const fin = sumarDias(inicio, 6);
    return { inicio, fin };
  });

  const rangoInicio = toIsoDia(rangosSemana[0].inicio);
  const rangoFin = toIsoDia(rangosSemana[rangosSemana.length - 1].fin);

  const jornadaRows = await db
    .select()
    .from(jornadas)
    .where(
      and(
        eq(jornadas.empleadoId, id),
        gte(jornadas.fecha, rangoInicio),
        lte(jornadas.fecha, rangoFin),
      ),
    );

  const jornadaPorFecha = new Map(jornadaRows.map((j) => [j.fecha, j]));

  const semanas: SemanaAsistencia[] = rangosSemana.map(({ inicio }) => {
    const dias: DiaAsistencia[] = [];
    let minutosSemana = 0;
    for (let i = 0; i < 7; i++) {
      const fechaDia = toIsoDia(sumarDias(inicio, i));
      const jornada = jornadaPorFecha.get(fechaDia);
      if (jornada) {
        dias.push({
          fecha: fechaDia,
          estado: jornada.estado as EstadoJornada,
          minutos: jornada.minutos,
        });
        if (jornada.minutos) minutosSemana += jornada.minutos;
      } else {
        dias.push({ fecha: fechaDia, estado: "falta", minutos: null });
      }
    }
    return { label: etiquetaSemana(inicio), dias, minutos: minutosSemana };
  });

  return {
    id: emp.id,
    nombre: emp.nombre,
    puesto: emp.puesto,
    tarifa: Number(emp.tarifa),
    unidad: emp.unidad,
    fechaIngreso: emp.fechaIngreso,
    activo: emp.activo,
    fotoUrl: emp.fotoUrl,
    uid: emp.uid ?? null,
    ultimaChecada,
    fechaBaja: emp.fechaBaja ?? null,
    tarjetaAsignadaEn: fechaAIso(emp.tarjetaAsignadaEn),
    historial,
    conceptos: conceptosOut,
    semanas,
  };
}

// ---------------------------------------------------------------------------
// listarPeriodos
// ---------------------------------------------------------------------------

export async function listarPeriodos(): Promise<PeriodoRow[]> {
  const rows = await db.select().from(periodos).orderBy(desc(periodos.fechaInicio));
  return rows.map(mapPeriodo);
}

// ---------------------------------------------------------------------------
// calcularNomina
// ---------------------------------------------------------------------------

export async function calcularNomina(periodoId: number): Promise<NominaPeriodo> {
  const [periodoRow] = await db.select().from(periodos).where(eq(periodos.id, periodoId)).limit(1);
  if (!periodoRow) {
    throw new Error(`No existe el periodo ${periodoId}`);
  }
  const periodo = mapPeriodo(periodoRow);

  const empleadosActivos = await db.select().from(empleados).where(eq(empleados.activo, true));

  const jornadaAggRows = await db
    .select({
      empleadoId: jornadas.empleadoId,
      diasCount: sql<string>`count(*) filter (where ${jornadas.estado} in ('completa', 'incompleta'))`,
      minutosSum: sql<string>`coalesce(sum(${jornadas.minutos}) filter (where ${jornadas.estado} in ('completa', 'incompleta')), 0)`,
      incompletaCount: sql<string>`count(*) filter (where ${jornadas.estado} = 'incompleta')`,
    })
    .from(jornadas)
    .where(and(gte(jornadas.fecha, periodo.fechaInicio), lte(jornadas.fecha, periodo.fechaFin)))
    .groupBy(jornadas.empleadoId);

  const jornadaPorEmpleado = new Map(
    jornadaAggRows
      .filter((r) => r.empleadoId !== null)
      .map((r) => [
        r.empleadoId as number,
        {
          dias: Number(r.diasCount),
          minutos: Number(r.minutosSum),
          incompleta: Number(r.incompletaCount) > 0,
        },
      ]),
  );

  const conceptoAggRows = await db
    .select({
      empleadoId: conceptos.empleadoId,
      tipo: conceptos.tipo,
      total: sql<string>`coalesce(sum(${conceptos.monto}), 0)`,
    })
    .from(conceptos)
    .where(or(eq(conceptos.recurrente, true), eq(conceptos.periodoId, periodoId)))
    .groupBy(conceptos.empleadoId, conceptos.tipo);

  const conceptoPorEmpleado = new Map<number, { bonos: number; descuentos: number }>();
  for (const row of conceptoAggRows) {
    const actual = conceptoPorEmpleado.get(row.empleadoId) ?? { bonos: 0, descuentos: 0 };
    const monto = Number(row.total);
    if (row.tipo === "bono") {
      actual.bonos += monto;
    } else {
      // 'descuento' | 'prestamo'
      actual.descuentos += monto;
    }
    conceptoPorEmpleado.set(row.empleadoId, actual);
  }

  const tarjetaActivaRows = await db
    .select({ empleadoId: tarjetas.empleadoId })
    .from(tarjetas)
    .where(eq(tarjetas.activa, true));
  const empleadosConTarjeta = new Set(
    tarjetaActivaRows.filter((r) => r.empleadoId !== null).map((r) => r.empleadoId as number),
  );

  const filas: ReciboCalculado[] = empleadosActivos.map((emp) => {
    const tarifa = Number(emp.tarifa);
    const jornadaInfo = jornadaPorEmpleado.get(emp.id) ?? { dias: 0, minutos: 0, incompleta: false };
    const conceptoInfo = conceptoPorEmpleado.get(emp.id) ?? { bonos: 0, descuentos: 0 };

    const cantidadRaw = emp.unidad === "dia" ? jornadaInfo.dias : round1(jornadaInfo.minutos / 60);
    const sueldoRaw = tarifa * cantidadRaw;
    const bonosRaw = conceptoInfo.bonos;
    const descuentosRaw = conceptoInfo.descuentos;
    const netoRaw = sueldoRaw + bonosRaw - descuentosRaw;

    return {
      empleadoId: emp.id,
      nombre: emp.nombre,
      puesto: emp.puesto,
      tarifa: round2(tarifa),
      unidad: emp.unidad,
      cantidad: cantidadRaw,
      sueldo: round2(sueldoRaw),
      bonos: round2(bonosRaw),
      descuentos: round2(descuentosRaw),
      neto: round2(netoRaw),
      incompleta: jornadaInfo.incompleta,
    };
  });

  filas.sort((a, b) => b.neto - a.neto);

  const totales = filas.reduce(
    (acc, fila) => {
      acc.sueldo += fila.sueldo;
      acc.bonos += fila.bonos;
      acc.descuentos += fila.descuentos;
      acc.neto += fila.neto;
      if (fila.unidad === "dia") acc.dias += fila.cantidad;
      else acc.horas += fila.cantidad;
      return acc;
    },
    { sueldo: 0, bonos: 0, descuentos: 0, neto: 0, dias: 0, horas: 0 },
  );

  const alertas = {
    incompletas: filas.filter((f) => f.incompleta).length,
    sinTarjeta: empleadosActivos.filter((e) => !empleadosConTarjeta.has(e.id)).length,
  };

  return {
    periodo,
    filas,
    totales: {
      sueldo: round2(totales.sueldo),
      bonos: round2(totales.bonos),
      descuentos: round2(totales.descuentos),
      neto: round2(totales.neto),
      dias: round2(totales.dias),
      horas: round1(totales.horas),
    },
    alertas,
  };
}
