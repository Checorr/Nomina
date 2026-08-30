"use server";

import { obtenerEmpleado, calcularNomina, listarEmpleados } from "@/lib/queries";
import type {
  EmpleadoDetalle,
  EmpleadoRow,
  NominaPeriodo,
} from "@/lib/contracts";

/**
 * Carga bajo demanda para el cliente. Se separa de la carga inicial de la
 * página porque traer el historial, los conceptos y 4 semanas de asistencia de
 * los 16 empleados en cada render de la lista sería desperdicio.
 */

export async function obtenerFicha(id: number): Promise<EmpleadoDetalle | null> {
  return obtenerEmpleado(id);
}

export async function obtenerNomina(periodoId: number): Promise<NominaPeriodo> {
  return calcularNomina(periodoId);
}

export async function refrescarEmpleados(): Promise<EmpleadoRow[]> {
  return listarEmpleados();
}
