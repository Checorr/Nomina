import { config } from "dotenv";
config({ path: ".env.local", quiet: true });

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";
import {
  ajustes,
  checadas,
  conceptos,
  empleados,
  historialTarifas,
  jornadas,
  periodos,
  recibos,
  tarjetas,
} from "./schema";

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema });

// ---------------------------------------------------------------------------
// Datos crudos de empleados
// [nombre, puesto, tarifa, unidad, uid_tarjeta_o_null, fecha_ingreso_dd/mm/aaaa, activo]
// ---------------------------------------------------------------------------

type FilaEmpleado = [string, string, number, "hora" | "día", string | null, string, boolean];

const empleadosData: FilaEmpleado[] = [
  ["María Fernanda Rosales Gómez", "Producción", 62, "hora", "A3 F1 9C 42", "14/03/2023", true],
  ["José Luis Hernández Mata", "Almacén", 480, "día", "7B 20 D4 11", "02/08/2021", true],
  ["Guadalupe Ramírez Ortiz", "Limpieza", 48, "hora", null, "05/11/2024", true],
  ["Ricardo Alonso Vázquez Lara", "Chofer", 620, "día", "19 8E 55 C0", "20/05/2019", true],
  ["Ana Karen Domínguez Sánchez", "Ventas", 78, "hora", "44 C1 07 9F", "17/01/2022", true],
  ["Miguel Ángel Trejo Sandoval", "Producción", 55, "hora", "D2 66 3A 84", "09/09/2022", true],
  ["Silvia Patricia Núñez Robles", "Producción", 390, "día", "5F 91 BB 07", "28/02/2023", true],
  ["Jorge Iván Cervantes Pineda", "Almacén", 52, "hora", null, "03/06/2026", true],
  ["Fernanda Lizeth Aguilar Ruiz", "Ventas", 85, "hora", "0C 3D 72 A6", "11/07/2020", true],
  ["Rubén Castañeda Fuentes", "Chofer", 560, "día", "B8 47 1E 33", "23/10/2021", true],
  ["Norma Angélica Fuentes Mora", "Limpieza", 320, "día", "6A 12 F8 5D", "30/01/2024", true],
  ["Héctor Manuel Ibarra Chávez", "Producción", 58, "hora", "2E 90 CC 71", "15/04/2023", true],
  ["Claudia Berenice Salas Ojeda", "Ventas", 72, "hora", "91 04 6D B2", "07/12/2022", true],
  ["Óscar Eduardo Villalobos Ayón", "Almacén", 505, "día", "3C 7F 21 08", "19/09/2019", true],
  ["Leticia Moreno Cárdenas", "Producción", 45, "hora", "AF 58 93 16", "22/05/2025", true],
  ["Sergio Alberto Peña Guzmán", "Producción", 650, "día", null, "04/02/2020", false],
];

/** Convierte dd/mm/aaaa -> aaaa-mm-dd */
function aIso(fecha: string): string {
  const [dia, mes, anio] = fecha.split("/");
  return `${anio}-${mes}-${dia}`;
}

/** Normaliza la unidad ("día" -> "dia") al valor del enum de Postgres. */
function aUnidadEnum(unidad: "hora" | "día"): "hora" | "dia" {
  return unidad === "día" ? "dia" : "hora";
}

async function limpiar() {
  // Se borra en orden inverso a las dependencias por llave foránea.
  await db.delete(recibos);
  await db.delete(conceptos);
  await db.delete(ajustes);
  await db.delete(jornadas);
  await db.delete(historialTarifas);
  await db.delete(checadas);
  await db.delete(tarjetas);
  await db.delete(periodos);
  await db.delete(empleados);
}

async function sembrarEmpleadosYTarjetas() {
  const empleadosInsertados: schema.Empleado[] = [];

  for (const fila of empleadosData) {
    const [nombre, puesto, tarifa, unidad, uidTarjeta, fechaIngreso, activo] = fila;

    const [empleado] = await db
      .insert(empleados)
      .values({
        nombre,
        puesto,
        tarifa: tarifa.toFixed(2),
        unidad: aUnidadEnum(unidad),
        fechaIngreso: aIso(fechaIngreso),
        activo,
        fechaBaja: activo ? null : null,
      })
      .returning();

    empleadosInsertados.push(empleado);

    if (uidTarjeta) {
      await db.insert(tarjetas).values({
        uid: uidTarjeta,
        empleadoId: empleado.id,
        activa: activo,
      });
    }
  }

  return empleadosInsertados;
}

async function sembrarHistorialTarifas(empleadosInsertados: schema.Empleado[]) {
  // Índice 0: María Fernanda Rosales Gómez (Producción, hora)
  const mariaFernanda = empleadosInsertados[0];
  // Índice 1: José Luis Hernández Mata (Almacén, día)
  const joseLuis = empleadosInsertados[1];

  // Alta + dos aumentos para María Fernanda (tarifa actual: 62/hora)
  await db.insert(historialTarifas).values([
    {
      empleadoId: mariaFernanda.id,
      tarifaAnterior: null,
      unidadAnterior: null,
      tarifaNueva: "50.00",
      unidadNueva: "hora",
      autor: "R. Medina",
      creadoEn: new Date("2023-03-14T12:00:00Z"),
    },
    {
      empleadoId: mariaFernanda.id,
      tarifaAnterior: "50.00",
      unidadAnterior: "hora",
      tarifaNueva: "56.00",
      unidadNueva: "hora",
      autor: "R. Medina",
      creadoEn: new Date("2024-06-01T12:00:00Z"),
    },
    {
      empleadoId: mariaFernanda.id,
      tarifaAnterior: "56.00",
      unidadAnterior: "hora",
      tarifaNueva: "62.00",
      unidadNueva: "hora",
      autor: "L. Ochoa",
      creadoEn: new Date("2025-06-01T12:00:00Z"),
    },
  ]);

  // Alta + dos aumentos para José Luis (tarifa actual: 480/día)
  await db.insert(historialTarifas).values([
    {
      empleadoId: joseLuis.id,
      tarifaAnterior: null,
      unidadAnterior: null,
      tarifaNueva: "400.00",
      unidadNueva: "dia",
      autor: "L. Ochoa",
      creadoEn: new Date("2021-08-02T12:00:00Z"),
    },
    {
      empleadoId: joseLuis.id,
      tarifaAnterior: "400.00",
      unidadAnterior: "dia",
      tarifaNueva: "440.00",
      unidadNueva: "dia",
      autor: "R. Medina",
      creadoEn: new Date("2023-08-01T12:00:00Z"),
    },
    {
      empleadoId: joseLuis.id,
      tarifaAnterior: "440.00",
      unidadAnterior: "dia",
      tarifaNueva: "480.00",
      unidadNueva: "dia",
      autor: "L. Ochoa",
      creadoEn: new Date("2025-08-01T12:00:00Z"),
    },
  ]);
}

async function sembrarConceptosRecurrentes(empleadosInsertados: schema.Empleado[]) {
  const mariaFernanda = empleadosInsertados[0]; // préstamo
  // Un par de empleados con bono de puntualidad/asistencia.
  const anaKaren = empleadosInsertados[4]; // Ventas
  const rubenCastaneda = empleadosInsertados[9]; // Chofer

  await db.insert(conceptos).values([
    {
      empleadoId: mariaFernanda.id,
      periodoId: null,
      tipo: "prestamo",
      descripcion: "Préstamo personal - descuento semanal",
      monto: "250.00",
      recurrente: true,
      saldoRestante: "1500.00",
    },
    {
      empleadoId: anaKaren.id,
      periodoId: null,
      tipo: "bono",
      descripcion: "Bono de puntualidad y asistencia",
      monto: "150.00",
      recurrente: true,
      saldoRestante: null,
    },
    {
      empleadoId: rubenCastaneda.id,
      periodoId: null,
      tipo: "bono",
      descripcion: "Bono de puntualidad y asistencia",
      monto: "150.00",
      recurrente: true,
      saldoRestante: null,
    },
  ]);
}

async function sembrarPeriodos() {
  const filas = [
    { fechaInicio: "2026-08-03", fechaFin: "2026-08-09", estado: "cerrado" as const },
    { fechaInicio: "2026-08-10", fechaFin: "2026-08-16", estado: "cerrado" as const },
    { fechaInicio: "2026-08-17", fechaFin: "2026-08-23", estado: "cerrado" as const },
    { fechaInicio: "2026-08-24", fechaFin: "2026-08-30", estado: "abierto" as const },
  ];

  for (const fila of filas) {
    await db.insert(periodos).values({
      fechaInicio: fila.fechaInicio,
      fechaFin: fila.fechaFin,
      estado: fila.estado,
      cerradoEn: fila.estado === "cerrado" ? new Date(`${fila.fechaFin}T20:00:00Z`) : null,
    });
  }
}

async function contarFilas() {
  const tablas: Record<string, unknown> = {
    empleados,
    tarjetas,
    checadas,
    jornadas,
    ajustes,
    historial_tarifas: historialTarifas,
    periodos,
    conceptos,
    recibos,
  };

  const conteos: Record<string, number> = {};
  for (const [nombre, tabla] of Object.entries(tablas)) {
    // @ts-expect-error -- tabla es una pg-core table válida en tiempo de ejecución
    const filas = await db.select().from(tabla);
    conteos[nombre] = filas.length;
  }
  return conteos;
}

async function main() {
  console.log("Limpiando tablas...");
  await limpiar();

  console.log("Sembrando empleados y tarjetas...");
  const empleadosInsertados = await sembrarEmpleadosYTarjetas();

  console.log("Sembrando historial de tarifas...");
  await sembrarHistorialTarifas(empleadosInsertados);

  console.log("Sembrando conceptos recurrentes...");
  await sembrarConceptosRecurrentes(empleadosInsertados);

  console.log("Sembrando periodos...");
  await sembrarPeriodos();

  console.log("\nConteo de filas por tabla:");
  const conteos = await contarFilas();
  console.table(conteos);
}

main()
  .then(() => {
    console.log("Seed completado.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Error al sembrar la base de datos:", err);
    process.exit(1);
  });
