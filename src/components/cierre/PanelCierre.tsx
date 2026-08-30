"use client";

import { useState } from "react";
import type { NominaPeriodo, PeriodoRow } from "@/lib/contracts";
import { money } from "@/lib/format";
import { cerrarPeriodo } from "@/app/actions";
import {
  alertaIncompletasTexto,
  bonoLabel,
  descuentoLabel,
  formatCantidad,
  pluralEmpleados,
  rangoSemana,
  tarifaLabel,
  tiempoLabel,
} from "./formatoCierre";
import styles from "./PanelCierre.module.css";

type PanelCierreProps = {
  nomina: NominaPeriodo;
  /**
   * Todos los periodos, usados aquí para exigir que se cierren en orden
   * cronológico: si hay una semana anterior todavía abierta, se bloquea el
   * cierre de esta y se ofrece saltar a ella (ver `anteriorAbierto` más
   * abajo). El selector "‹ semana ›" en sí vive en el header de la app
   * (fuera de nuestro alcance), no aquí.
   */
  periodos: PeriodoRow[];
  /** Usado para saltar a una semana anterior aún abierta (ver arriba). */
  onCambiarPeriodo: (id: number) => void;
  /** Se dispara al hacer clic en "Revisar" dentro de la banda de alerta de checadas incompletas. */
  onRevisar?: () => void;
  /** Se dispara tras un cierre exitoso, para que el padre refresque `nomina`. */
  onCerrado?: () => void;
};

/**
 * Panel principal de la pestaña "Cierre de nómina": totales de la semana,
 * alerta de checadas incompletas, barras de pago por empleado, tabla de
 * detalle de cálculo y la barra de cierre con confirmación.
 *
 * No incluye su propio contenedor de scroll/padding: el padre (ver
 * `AppShell`) ya envuelve este panel en `flex:1;overflow-y:auto;padding:0
 * 24px 28px 24px`, tal como el prototipo.
 */
export default function PanelCierre({ nomina, periodos, onCambiarPeriodo, onRevisar, onCerrado }: PanelCierreProps) {
  const { periodo, filas, totales, alertas } = nomina;

  const [cerradosLocal, setCerradosLocal] = useState<Set<number>>(() => new Set());
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Al cambiar de semana, cualquier diálogo/error de la semana anterior deja
  // de ser relevante. Se ajusta durante el render (patrón recomendado por
  // React para "resetear estado cuando cambia una prop") en vez de un
  // useEffect, para no disparar un re-render en cascada.
  const [periodoVisto, setPeriodoVisto] = useState(periodo.id);
  if (periodoVisto !== periodo.id) {
    setPeriodoVisto(periodo.id);
    setConfirmando(false);
    setError(null);
  }

  const estaCerrado = periodo.estado !== "abierto" || cerradosLocal.has(periodo.id);
  const hayChecadas = totales.horas > 0 || totales.dias > 0;
  const maxTotal = Math.max(...filas.map((f) => f.neto + f.descuentos), 1);
  const conDescuento = filas.filter((f) => f.descuentos > 0).length;

  // Regla de negocio: no se puede cerrar una semana si hay una anterior
  // todavía abierta (evita huecos en el historial de nómina).
  const anteriorAbierto = periodos.find(
    (p) => p.id !== periodo.id && p.estado === "abierto" && p.fechaInicio < periodo.fechaInicio,
  );

  async function handleCerrar() {
    setEnviando(true);
    setError(null);
    const resultado = await cerrarPeriodo(periodo.id);
    setEnviando(false);
    if (resultado.ok) {
      setCerradosLocal((prev) => {
        const next = new Set(prev);
        next.add(periodo.id);
        return next;
      });
      setConfirmando(false);
      onCerrado?.();
    } else {
      setError(resultado.error);
    }
  }

  return (
    <>
      {/* 1. Tarjetas de totales */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.15fr 1fr 1fr 1fr",
          gap: 0,
          border: "1px solid var(--line2)",
          borderRadius: 3,
          margin: "18px 0 6px 0",
        }}
      >
        <div style={{ padding: "14px 18px", borderRight: "1px solid var(--line)" }}>
          <div className="section-label">Total a pagar</div>
          <div className="mono" style={{ fontSize: 30, fontWeight: 600, letterSpacing: "-0.025em", marginTop: 6 }}>
            {money(totales.neto)}
          </div>
          <div style={{ fontSize: 11, color: "var(--fg2)", marginTop: 2 }}>{pluralEmpleados(filas.length)}</div>
        </div>
        <div style={{ padding: "14px 18px", borderRight: "1px solid var(--line)" }}>
          <div className="section-label">Sueldos</div>
          <div className="mono" style={{ fontSize: 19, fontWeight: 500, marginTop: 8 }}>
            {money(totales.sueldo)}
          </div>
          <div style={{ fontSize: 11, color: "var(--fg2)", marginTop: 3 }}>
            {formatCantidad(totales.horas)} h y {formatCantidad(totales.dias)} jornadas
          </div>
        </div>
        <div style={{ padding: "14px 18px", borderRight: "1px solid var(--line)" }}>
          <div className="section-label">Bonos</div>
          <div className="mono" style={{ fontSize: 19, fontWeight: 500, marginTop: 8 }}>
            + {money(totales.bonos)}
          </div>
          <div style={{ fontSize: 11, color: "var(--fg2)", marginTop: 3 }}>Puntualidad y asistencia</div>
        </div>
        <div style={{ padding: "14px 18px" }}>
          <div className="section-label">Descuentos</div>
          <div className="mono" style={{ fontSize: 19, fontWeight: 500, marginTop: 8 }}>
            − {money(totales.descuentos)}
          </div>
          <div style={{ fontSize: 11, color: "var(--fg2)", marginTop: 3 }}>{pluralEmpleados(conDescuento)} con descuento</div>
        </div>
      </div>

      {/* 2. Banda de alerta de checadas incompletas */}
      {alertas.incompletas > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            border: "1px solid var(--warn)",
            background: "var(--warn-soft)",
            borderRadius: 3,
            padding: "9px 13px",
            marginBottom: 6,
          }}
        >
          <span className="mono" style={{ fontSize: 10, fontWeight: 600, color: "var(--warn)" }}>
            !
          </span>
          <span style={{ fontSize: 12, color: "var(--fg)" }}>{alertaIncompletasTexto(alertas.incompletas)}</span>
          <button type="button" onClick={() => onRevisar?.()} className={styles.botonRevisar}>
            Revisar
          </button>
        </div>
      )}

      {/* 3. Pago por empleado */}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", margin: "18px 0 10px 0" }}>
        <div className="section-label">Pago por empleado</div>
        <div className="mono" style={{ display: "flex", gap: 14, fontSize: 9.5, color: "var(--fg3)" }}>
          <span>■ neto a pagar</span>
          <span>□ descuento</span>
        </div>
      </div>

      {!hayChecadas && (
        <div style={{ fontSize: 11, color: "var(--fg3)", marginBottom: 10, lineHeight: 1.5 }}>
          Aún no hay checadas registradas para esta semana — los importes se calcularán en cuanto haya asistencia
          capturada.
        </div>
      )}

      <div style={{ borderTop: "1px solid var(--line2)" }}>
        {filas.map((fila) => {
          const wNeto = (fila.neto / maxTotal) * 100;
          const wDesc = (fila.descuentos / maxTotal) * 100;
          return (
            <div
              key={fila.empleadoId}
              style={{
                display: "grid",
                gridTemplateColumns: "210px 1fr 116px",
                gap: 14,
                alignItems: "center",
                height: 26,
                borderBottom: "1px solid var(--line)",
              }}
            >
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, minWidth: 0 }}>
                <span style={{ fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {fila.nombre}
                </span>
                <span className="mono" style={{ fontSize: 9.5, color: "var(--fg3)", whiteSpace: "nowrap" }}>
                  {tiempoLabel(fila.cantidad, fila.unidad)}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", height: "100%" }}>
                <div style={{ display: "flex", height: 11, width: "100%" }}>
                  <div style={{ width: `${wNeto}%`, background: "var(--fg2)" }} />
                  <div style={{ width: `${wDesc}%`, border: "1px solid var(--fg3)", borderLeft: 0, background: "transparent" }} />
                </div>
              </div>
              <div className="mono" style={{ fontSize: 12.5, fontWeight: 600, textAlign: "right" }}>
                {money(fila.neto)}
              </div>
            </div>
          );
        })}
      </div>

      {/* 4. Detalle de cálculo */}
      <div className="section-label" style={{ margin: "26px 0 8px 0" }}>
        Detalle de cálculo
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th
              className="mono"
              style={{
                textAlign: "left",
                fontSize: 9,
                fontWeight: 500,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--fg3)",
                borderBottom: "1px solid var(--line2)",
                padding: "0 8px 6px 0",
              }}
            >
              Empleado
            </th>
            {["Tarifa", "Tiempo", "Sueldo", "Bonos", "Descuentos"].map((h) => (
              <th
                key={h}
                className="mono"
                style={{
                  textAlign: "right",
                  fontSize: 9,
                  fontWeight: 500,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "var(--fg3)",
                  borderBottom: "1px solid var(--line2)",
                  padding: "0 8px 6px 8px",
                }}
              >
                {h}
              </th>
            ))}
            <th
              className="mono"
              style={{
                textAlign: "right",
                fontSize: 9,
                fontWeight: 500,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--fg3)",
                borderBottom: "1px solid var(--line2)",
                padding: "0 0 6px 8px",
              }}
            >
              Neto
            </th>
          </tr>
        </thead>
        <tbody>
          {filas.map((fila) => (
            <tr key={fila.empleadoId}>
              <td style={{ fontSize: 12, borderBottom: "1px solid var(--line)", padding: "6px 8px 6px 0" }}>{fila.nombre}</td>
              <td
                className="mono"
                style={{ fontSize: 11.5, color: "var(--fg2)", textAlign: "right", borderBottom: "1px solid var(--line)", padding: "6px 8px" }}
              >
                {tarifaLabel(fila.tarifa, fila.unidad)}
              </td>
              <td
                className="mono"
                style={{ fontSize: 11.5, color: "var(--fg2)", textAlign: "right", borderBottom: "1px solid var(--line)", padding: "6px 8px" }}
              >
                {tiempoLabel(fila.cantidad, fila.unidad)}
              </td>
              <td className="mono" style={{ fontSize: 11.5, textAlign: "right", borderBottom: "1px solid var(--line)", padding: "6px 8px" }}>
                {money(fila.sueldo)}
              </td>
              <td
                className="mono"
                style={{ fontSize: 11.5, color: "var(--fg2)", textAlign: "right", borderBottom: "1px solid var(--line)", padding: "6px 8px" }}
              >
                {bonoLabel(fila.bonos)}
              </td>
              <td
                className="mono"
                style={{ fontSize: 11.5, color: "var(--fg2)", textAlign: "right", borderBottom: "1px solid var(--line)", padding: "6px 8px" }}
              >
                {descuentoLabel(fila.descuentos)}
              </td>
              <td
                className="mono"
                style={{ fontSize: 12.5, fontWeight: 600, textAlign: "right", borderBottom: "1px solid var(--line)", padding: "6px 0 6px 8px" }}
              >
                {money(fila.neto)}
              </td>
            </tr>
          ))}
          <tr>
            <td style={{ fontSize: 12, fontWeight: 600, borderTop: "2px solid var(--fg)", padding: "8px 8px 8px 0" }}>Total semana</td>
            <td style={{ borderTop: "2px solid var(--fg)" }}></td>
            <td
              className="mono"
              style={{ fontSize: 11.5, color: "var(--fg2)", textAlign: "right", borderTop: "2px solid var(--fg)", padding: 8 }}
            >
              {formatCantidad(totales.horas)} h · {formatCantidad(totales.dias)} d
            </td>
            <td className="mono" style={{ fontSize: 12, fontWeight: 600, textAlign: "right", borderTop: "2px solid var(--fg)", padding: 8 }}>
              {money(totales.sueldo)}
            </td>
            <td className="mono" style={{ fontSize: 12, fontWeight: 600, textAlign: "right", borderTop: "2px solid var(--fg)", padding: 8 }}>
              {bonoLabel(totales.bonos)}
            </td>
            <td className="mono" style={{ fontSize: 12, fontWeight: 600, textAlign: "right", borderTop: "2px solid var(--fg)", padding: 8 }}>
              {descuentoLabel(totales.descuentos)}
            </td>
            <td
              className="mono"
              style={{ fontSize: 14, fontWeight: 600, textAlign: "right", borderTop: "2px solid var(--fg)", padding: "8px 0 8px 8px" }}
            >
              {money(totales.neto)}
            </td>
          </tr>
        </tbody>
      </table>

      {/* 5. Barra de cierre */}
      <div
        data-noprint=""
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          border: "1px solid var(--line2)",
          borderRadius: 3,
          padding: "14px 16px",
          marginTop: 22,
        }}
      >
        <div style={{ fontSize: 11.5, color: "var(--fg2)", lineHeight: 1.5, maxWidth: 560 }}>
          Al cerrar la semana se congelan tarifas, checadas y descuentos de {rangoSemana(periodo)}. Los cambios
          posteriores se aplican a la siguiente nómina.
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={() => window.print()} className={styles.botonSecundario}>
              Imprimir recibos
            </button>
            <button
              type="button"
              onClick={() => setConfirmando(true)}
              disabled={estaCerrado || !!anteriorAbierto}
              title={anteriorAbierto ? `Cierra primero la semana del ${rangoSemana(anteriorAbierto)}` : undefined}
              className={styles.botonPrimario}
            >
              {estaCerrado ? "Semana cerrada ✓" : "Cerrar nómina"}
            </button>
          </div>
          {error && <div style={{ fontSize: 10.5, color: "var(--neg)", textAlign: "right" }}>{error}</div>}
          {!estaCerrado && anteriorAbierto && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 10.5, color: "var(--warn)" }}>
              <span>Cierra primero la semana del {rangoSemana(anteriorAbierto)}.</span>
              <button
                type="button"
                onClick={() => onCambiarPeriodo(anteriorAbierto.id)}
                style={{
                  border: 0,
                  background: "transparent",
                  color: "var(--warn)",
                  textDecoration: "underline",
                  cursor: "pointer",
                  padding: 0,
                  fontSize: 10.5,
                }}
              >
                Ir a esa semana
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Confirmación de cierre */}
      {confirmando && (
        <div data-noprint="" className={styles.overlay} onClick={() => !enviando && setConfirmando(false)}>
          <div className={styles.dialogo} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--line)" }}>
              <div style={{ fontSize: 14.5, fontWeight: 600 }}>¿Cerrar la nómina de {rangoSemana(periodo)}?</div>
            </div>
            <div style={{ padding: 20 }}>
              <div style={{ fontSize: 12.5, color: "var(--fg)", lineHeight: 1.6 }}>
                Se van a congelar tarifas, checadas y descuentos para{" "}
                <strong>{pluralEmpleados(filas.length)}</strong>, por un total de{" "}
                <span className="mono" style={{ fontWeight: 600 }}>
                  {money(totales.neto)}
                </span>
                . Esta acción no se puede deshacer desde aquí.
              </div>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 8,
                padding: "14px 20px",
                borderTop: "1px solid var(--line)",
                background: "var(--panel2)",
              }}
            >
              <button type="button" onClick={() => setConfirmando(false)} disabled={enviando} className={styles.botonCancelar}>
                Cancelar
              </button>
              <button type="button" onClick={handleCerrar} disabled={enviando} className={styles.botonConfirmar}>
                {enviando ? "Cerrando…" : "Sí, cerrar nómina"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
