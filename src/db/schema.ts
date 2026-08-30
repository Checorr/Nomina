import { relations } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const unidadTarifaEnum = pgEnum("unidad_tarifa", ["hora", "dia"]);
export const estadoJornadaEnum = pgEnum("estado_jornada", [
  "completa",
  "incompleta",
  "falta",
  "descanso",
]);
export const estadoPeriodoEnum = pgEnum("estado_periodo", [
  "abierto",
  "cerrado",
  "pagado",
]);
export const tipoConceptoEnum = pgEnum("tipo_concepto", [
  "bono",
  "descuento",
  "prestamo",
]);

// ---------------------------------------------------------------------------
// empleados
// ---------------------------------------------------------------------------

export const empleados = pgTable("empleados", {
  id: serial("id").primaryKey(),
  nombre: text("nombre").notNull(),
  puesto: text("puesto").notNull(),
  tarifa: numeric("tarifa", { precision: 10, scale: 2 }).notNull(),
  unidad: unidadTarifaEnum("unidad").notNull().default("dia"),
  fechaIngreso: date("fecha_ingreso").notNull(),
  fotoUrl: text("foto_url"),
  activo: boolean("activo").notNull().default(true),
  fechaBaja: date("fecha_baja"),
  creadoEn: timestamp("creado_en", { withTimezone: true }).defaultNow(),
  actualizadoEn: timestamp("actualizado_en", { withTimezone: true }).defaultNow(),
});

// ---------------------------------------------------------------------------
// tarjetas
// ---------------------------------------------------------------------------

export const tarjetas = pgTable("tarjetas", {
  id: serial("id").primaryKey(),
  uid: text("uid").notNull().unique(),
  empleadoId: integer("empleado_id").references(() => empleados.id),
  activa: boolean("activa").notNull().default(true),
  asignadaEn: timestamp("asignada_en", { withTimezone: true }).defaultNow(),
  liberadaEn: timestamp("liberada_en", { withTimezone: true }),
});

// ---------------------------------------------------------------------------
// checadas (registro crudo, inmutable)
// ---------------------------------------------------------------------------

export const checadas = pgTable(
  "checadas",
  {
    id: serial("id").primaryKey(),
    uid: text("uid").notNull(),
    empleadoId: integer("empleado_id").references(() => empleados.id),
    marcadaEn: timestamp("marcada_en", { withTimezone: true }).notNull(),
    dispositivo: text("dispositivo"),
    sincronizadaEn: timestamp("sincronizada_en", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("checadas_empleado_marcada_idx").on(table.empleadoId, table.marcadaEn),
  ],
);

// ---------------------------------------------------------------------------
// jornadas (derivadas de las checadas)
// ---------------------------------------------------------------------------

export const jornadas = pgTable(
  "jornadas",
  {
    id: serial("id").primaryKey(),
    empleadoId: integer("empleado_id")
      .notNull()
      .references(() => empleados.id),
    fecha: date("fecha").notNull(),
    entrada: timestamp("entrada", { withTimezone: true }),
    salida: timestamp("salida", { withTimezone: true }),
    minutos: integer("minutos"),
    estado: estadoJornadaEnum("estado").notNull().default("falta"),
  },
  (table) => [
    unique("jornadas_empleado_fecha_unique").on(table.empleadoId, table.fecha),
  ],
);

// ---------------------------------------------------------------------------
// ajustes (auditoría de correcciones manuales a jornadas)
// ---------------------------------------------------------------------------

export const ajustes = pgTable("ajustes", {
  id: serial("id").primaryKey(),
  jornadaId: integer("jornada_id").references(() => jornadas.id),
  campo: text("campo").notNull(),
  valorAnterior: text("valor_anterior"),
  valorNuevo: text("valor_nuevo"),
  autor: text("autor").notNull(),
  motivo: text("motivo"),
  creadoEn: timestamp("creado_en", { withTimezone: true }).defaultNow(),
});

// ---------------------------------------------------------------------------
// historial_tarifas
// ---------------------------------------------------------------------------

export const historialTarifas = pgTable("historial_tarifas", {
  id: serial("id").primaryKey(),
  empleadoId: integer("empleado_id")
    .notNull()
    .references(() => empleados.id),
  tarifaAnterior: numeric("tarifa_anterior", { precision: 10, scale: 2 }),
  unidadAnterior: text("unidad_anterior"),
  tarifaNueva: numeric("tarifa_nueva", { precision: 10, scale: 2 }).notNull(),
  unidadNueva: text("unidad_nueva").notNull(),
  autor: text("autor").notNull(),
  creadoEn: timestamp("creado_en", { withTimezone: true }).defaultNow(),
});

// ---------------------------------------------------------------------------
// periodos
// ---------------------------------------------------------------------------

export const periodos = pgTable("periodos", {
  id: serial("id").primaryKey(),
  fechaInicio: date("fecha_inicio").notNull().unique(),
  fechaFin: date("fecha_fin").notNull(),
  estado: estadoPeriodoEnum("estado").notNull().default("abierto"),
  cerradoEn: timestamp("cerrado_en", { withTimezone: true }),
});

// ---------------------------------------------------------------------------
// conceptos (bonos, descuentos, préstamos)
// ---------------------------------------------------------------------------

export const conceptos = pgTable("conceptos", {
  id: serial("id").primaryKey(),
  empleadoId: integer("empleado_id")
    .notNull()
    .references(() => empleados.id),
  periodoId: integer("periodo_id").references(() => periodos.id),
  tipo: tipoConceptoEnum("tipo").notNull(),
  descripcion: text("descripcion").notNull(),
  monto: numeric("monto", { precision: 10, scale: 2 }).notNull(),
  recurrente: boolean("recurrente").notNull().default(false),
  saldoRestante: numeric("saldo_restante", { precision: 10, scale: 2 }),
  creadoEn: timestamp("creado_en", { withTimezone: true }).defaultNow(),
});

// ---------------------------------------------------------------------------
// recibos (resultado congelado de una nómina)
// ---------------------------------------------------------------------------

export const recibos = pgTable(
  "recibos",
  {
    id: serial("id").primaryKey(),
    empleadoId: integer("empleado_id")
      .notNull()
      .references(() => empleados.id),
    periodoId: integer("periodo_id")
      .notNull()
      .references(() => periodos.id),
    tarifaSnapshot: numeric("tarifa_snapshot", { precision: 10, scale: 2 }).notNull(),
    unidadSnapshot: text("unidad_snapshot").notNull(),
    cantidad: numeric("cantidad", { precision: 10, scale: 2 }).notNull(),
    sueldo: numeric("sueldo", { precision: 12, scale: 2 }).notNull(),
    bonos: numeric("bonos", { precision: 12, scale: 2 }).notNull().default("0"),
    descuentos: numeric("descuentos", { precision: 12, scale: 2 }).notNull().default("0"),
    neto: numeric("neto", { precision: 12, scale: 2 }).notNull(),
    pagado: boolean("pagado").notNull().default(false),
    pagadoEn: timestamp("pagado_en", { withTimezone: true }),
  },
  (table) => [
    unique("recibos_empleado_periodo_unique").on(table.empleadoId, table.periodoId),
  ],
);

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const empleadosRelations = relations(empleados, ({ many }) => ({
  tarjetas: many(tarjetas),
  checadas: many(checadas),
  jornadas: many(jornadas),
  historialTarifas: many(historialTarifas),
  conceptos: many(conceptos),
  recibos: many(recibos),
}));

export const tarjetasRelations = relations(tarjetas, ({ one }) => ({
  empleado: one(empleados, {
    fields: [tarjetas.empleadoId],
    references: [empleados.id],
  }),
}));

export const checadasRelations = relations(checadas, ({ one }) => ({
  empleado: one(empleados, {
    fields: [checadas.empleadoId],
    references: [empleados.id],
  }),
}));

export const jornadasRelations = relations(jornadas, ({ one, many }) => ({
  empleado: one(empleados, {
    fields: [jornadas.empleadoId],
    references: [empleados.id],
  }),
  ajustes: many(ajustes),
}));

export const ajustesRelations = relations(ajustes, ({ one }) => ({
  jornada: one(jornadas, {
    fields: [ajustes.jornadaId],
    references: [jornadas.id],
  }),
}));

export const historialTarifasRelations = relations(historialTarifas, ({ one }) => ({
  empleado: one(empleados, {
    fields: [historialTarifas.empleadoId],
    references: [empleados.id],
  }),
}));

export const periodosRelations = relations(periodos, ({ many }) => ({
  conceptos: many(conceptos),
  recibos: many(recibos),
}));

export const conceptosRelations = relations(conceptos, ({ one }) => ({
  empleado: one(empleados, {
    fields: [conceptos.empleadoId],
    references: [empleados.id],
  }),
  periodo: one(periodos, {
    fields: [conceptos.periodoId],
    references: [periodos.id],
  }),
}));

export const recibosRelations = relations(recibos, ({ one }) => ({
  empleado: one(empleados, {
    fields: [recibos.empleadoId],
    references: [empleados.id],
  }),
  periodo: one(periodos, {
    fields: [recibos.periodoId],
    references: [periodos.id],
  }),
}));

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------

export type Empleado = typeof empleados.$inferSelect;
export type NuevoEmpleado = typeof empleados.$inferInsert;

export type Tarjeta = typeof tarjetas.$inferSelect;
export type NuevaTarjeta = typeof tarjetas.$inferInsert;

export type Checada = typeof checadas.$inferSelect;
export type NuevaChecada = typeof checadas.$inferInsert;

export type Jornada = typeof jornadas.$inferSelect;
export type NuevaJornada = typeof jornadas.$inferInsert;

export type Ajuste = typeof ajustes.$inferSelect;
export type NuevoAjuste = typeof ajustes.$inferInsert;

export type HistorialTarifa = typeof historialTarifas.$inferSelect;
export type NuevoHistorialTarifa = typeof historialTarifas.$inferInsert;

export type Periodo = typeof periodos.$inferSelect;
export type NuevoPeriodo = typeof periodos.$inferInsert;

export type Concepto = typeof conceptos.$inferSelect;
export type NuevoConcepto = typeof conceptos.$inferInsert;

export type Recibo = typeof recibos.$inferSelect;
export type NuevoRecibo = typeof recibos.$inferInsert;
