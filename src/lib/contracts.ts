/**
 * Contrato compartido entre la capa de datos y la UI.
 *
 * Regla: en la base de datos los montos son `numeric` y viajan como string
 * (para no perder centavos). Al cruzar esta frontera ya vienen convertidos a
 * `number`. Las fechas siempre son strings ISO (`aaaa-mm-dd` para fechas,
 * ISO 8601 completo para timestamps) — nunca objetos `Date`, para evitar
 * desfases de zona horaria en el cálculo de nómina.
 */

export type Unidad = "hora" | "dia";
export type EstadoJornada = "completa" | "incompleta" | "falta" | "descanso";
export type EstadoPeriodo = "abierto" | "cerrado" | "pagado";
export type TipoConcepto = "bono" | "descuento" | "prestamo";

/** Una fila de la tabla de Personal. */
export type EmpleadoRow = {
  id: number;
  nombre: string;
  puesto: string;
  tarifa: number;
  unidad: Unidad;
  /** ISO `aaaa-mm-dd` */
  fechaIngreso: string;
  activo: boolean;
  fotoUrl: string | null;
  /** UID de la tarjeta NFC activa, o null si no tiene ninguna asignada. */
  uid: string | null;
  /** ISO 8601 de la última checada, o null si nunca ha checado. */
  ultimaChecada: string | null;
};

export type CambioTarifa = {
  /** ISO `aaaa-mm-dd` */
  fecha: string;
  anterior: number | null;
  unidadAnterior: Unidad | null;
  nueva: number;
  unidadNueva: Unidad;
  autor: string;
};

export type ConceptoRow = {
  id: number;
  tipo: TipoConcepto;
  descripcion: string;
  monto: number;
  recurrente: boolean;
  /** Solo para préstamos: lo que falta por descontar. */
  saldoRestante: number | null;
  /**
   * Vigencia. Un concepto recurrente solo aplica a los periodos que traslapan
   * este rango. Sin esto, un préstamo dado de alta hoy aparecería cobrado en
   * semanas pasadas y seguiría descontándose para siempre después de saldado.
   * ISO `aaaa-mm-dd`. `vigenteHasta` en null = sin fecha de término.
   */
  vigenteDesde: string;
  vigenteHasta: string | null;
};

export type DiaAsistencia = {
  /** ISO `aaaa-mm-dd` */
  fecha: string;
  estado: EstadoJornada;
  minutos: number | null;
};

export type SemanaAsistencia = {
  /** Etiqueta corta para el eje, ej. "24 ago" */
  label: string;
  /** Siempre 7 elementos, de lunes a domingo. */
  dias: DiaAsistencia[];
  minutos: number;
};

/** Lo que alimenta el panel lateral de ficha de empleado. */
export type EmpleadoDetalle = EmpleadoRow & {
  fechaBaja: string | null;
  tarjetaAsignadaEn: string | null;
  historial: CambioTarifa[];
  conceptos: ConceptoRow[];
  /** Las últimas 4 semanas, de la más antigua a la más reciente. */
  semanas: SemanaAsistencia[];
};

export type PeriodoRow = {
  id: number;
  fechaInicio: string;
  fechaFin: string;
  estado: EstadoPeriodo;
};

/** Cálculo de pago de un empleado para un periodo. */
export type ReciboCalculado = {
  empleadoId: number;
  nombre: string;
  puesto: string;
  tarifa: number;
  unidad: Unidad;
  /** Días trabajados si unidad = "dia"; horas si unidad = "hora". */
  cantidad: number;
  sueldo: number;
  bonos: number;
  /** Lo que efectivamente se descuenta esta semana. Nunca deja el neto en negativo. */
  descuentos: number;
  /**
   * Lo que se quiso descontar pero no alcanzó a cobrarse porque el sueldo de la
   * semana no daba. No se pierde: queda pendiente para la siguiente nómina.
   * Normalmente 0.
   */
  descuentosDiferidos: number;
  /** Siempre >= 0. A un empleado no se le puede cobrar en su día de pago. */
  neto: number;
  /** true si el empleado tiene jornadas incompletas en el periodo. */
  incompleta: boolean;
};

export type NominaPeriodo = {
  periodo: PeriodoRow;
  /** Ordenadas de mayor a menor neto. */
  filas: ReciboCalculado[];
  totales: {
    sueldo: number;
    bonos: number;
    descuentos: number;
    /** Suma de lo diferido a la siguiente semana. Normalmente 0. */
    descuentosDiferidos: number;
    neto: number;
    dias: number;
    horas: number;
  };
  alertas: {
    incompletas: number;
    sinTarjeta: number;
    /** Cuántos empleados tienen descuento diferido por sueldo insuficiente. */
    conDiferidos: number;
  };
};

/** Resultado uniforme de toda server action. Nunca lanza al cliente. */
export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export type NuevoEmpleado = {
  nombre: string;
  puesto: string;
  tarifa: number;
  unidad: Unidad;
  /** ISO `aaaa-mm-dd` */
  fechaIngreso: string;
  /** UID de tarjeta a vincular en el alta, si ya se leyó. */
  uid?: string | null;
};
