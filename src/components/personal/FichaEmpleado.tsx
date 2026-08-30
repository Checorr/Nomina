"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { ConceptoRow, EmpleadoDetalle, EstadoJornada } from "@/lib/contracts";
import { fechaCorta, initials, money } from "@/lib/format";
import { darDeBaja, vincularTarjeta } from "@/app/actions";
import { generarUidSimulado } from "./nfc";
import styles from "./personal.module.css";

type FichaEmpleadoProps = {
  empleado: EmpleadoDetalle | null;
  onCerrar: () => void;
  /**
   * Se invoca tras dar de baja al empleado o vincular una tarjeta con
   * éxito, para que el padre refresque su copia de la lista de empleados.
   * No está en el contrato mínimo `{ empleado, onCerrar }` del encargo,
   * pero es indispensable para que estas dos acciones tengan efecto visible
   * fuera del panel (ver nota de "Vincular/reponer tarjeta" y "Dar de
   * baja" en el reporte final). Opcional para no romper el uso mínimo.
   */
  onCambio?: () => void;
};

function estiloDia(estado: EstadoJornada): { fondo: string; borde: string } {
  if (estado === "completa") return { fondo: "var(--fg2)", borde: "var(--fg2)" };
  if (estado === "incompleta") return { fondo: "var(--line2)", borde: "var(--fg3)" };
  return { fondo: "transparent", borde: "var(--line2)" };
}

function etiquetaEstado(estado: EstadoJornada): string {
  switch (estado) {
    case "completa":
      return "Jornada completa";
    case "incompleta":
      return "Jornada incompleta";
    case "falta":
      return "Falta";
    case "descanso":
      return "Descanso";
  }
}

/** Monto principal a mostrar por concepto: saldo restante para préstamos,
 * el monto fijo en cualquier otro caso. */
function conceptoMonto(c: ConceptoRow): number {
  return c.tipo === "prestamo" && c.saldoRestante != null ? c.saldoRestante : c.monto;
}

/** Texto secundario del concepto. El contrato (`ConceptoRow`) no trae un
 * campo de descripción libre como el prototipo ("Descuento $250.00 semanal
 * · 6 de 12 pagos"); se reconstruye a partir de `monto`/`saldoRestante`. */
function conceptoDetalle(c: ConceptoRow): string {
  if (c.tipo === "prestamo") {
    const saldo = c.saldoRestante != null ? ` · saldo ${money(c.saldoRestante)}` : "";
    return `Descuento ${money(c.monto)} semanal${saldo}`;
  }
  return c.recurrente ? "Fijo semanal" : "No recurrente";
}

function conceptoTag(c: ConceptoRow): string {
  return c.tipo === "prestamo" ? "saldo" : c.tipo;
}

const thStyle = (align: "left" | "right"): CSSProperties => ({
  textAlign: align,
  fontFamily: "var(--font-mono)",
  fontSize: 9,
  fontWeight: 500,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--fg3)",
  borderBottom: "1px solid var(--line2)",
  padding: "0 0 5px 0",
});

const tdStyle = (align: "left" | "right", color: string, size: number): CSSProperties => ({
  textAlign: align,
  fontFamily: "var(--font-mono)",
  fontSize: size,
  color,
  borderBottom: "1px solid var(--line)",
  padding: "6px 0",
});

const ghostBtnStyle: CSSProperties = {
  border: "1px solid var(--line2)",
  background: "transparent",
  color: "var(--fg2)",
  borderRadius: 2,
  height: 26,
  padding: "0 10px",
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  cursor: "pointer",
};

const primaryBtnStyle: CSSProperties = {
  border: "1px solid var(--accent)",
  background: "var(--accent)",
  color: "var(--panel)",
  borderRadius: 3,
  height: 28,
  padding: "0 12px",
  fontSize: 12,
  fontWeight: 500,
  cursor: "pointer",
};

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function FichaEmpleado({ empleado, onCerrar, onCambio }: FichaEmpleadoProps) {
  const [confirmandoBaja, setConfirmandoBaja] = useState(false);
  const [procesandoBaja, setProcesandoBaja] = useState(false);
  const [errorBaja, setErrorBaja] = useState<string | null>(null);

  const [vinculando, setVinculando] = useState(false);
  const [uidLeido, setUidLeido] = useState<string | null>(null);
  const [guardandoTarjeta, setGuardandoTarjeta] = useState(false);
  const [errorTarjeta, setErrorTarjeta] = useState<string | null>(null);

  const asideRef = useRef<HTMLElement | null>(null);

  // Reinicia el estado local cada vez que se abre una ficha distinta.
  useEffect(() => {
    setConfirmandoBaja(false);
    setProcesandoBaja(false);
    setErrorBaja(null);
    setVinculando(false);
    setUidLeido(null);
    setGuardandoTarjeta(false);
    setErrorTarjeta(null);
  }, [empleado?.id]);

  // Escape cierra el panel; el foco queda atrapado dentro de él mientras
  // está abierto (accesibilidad).
  useEffect(() => {
    if (!empleado) return;
    const previamenteEnfocado = document.activeElement as HTMLElement | null;
    const nodo = asideRef.current;

    const enfocables = () =>
      nodo ? Array.from(nodo.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)) : [];

    enfocables()[0]?.focus();

    function onKeyDown(e: globalThis.KeyboardEvent) {
      if (e.key === "Escape") {
        onCerrar();
        return;
      }
      if (e.key === "Tab") {
        const items = enfocables();
        if (items.length === 0) return;
        const primero = items[0];
        const ultimo = items[items.length - 1];
        if (e.shiftKey && document.activeElement === primero) {
          e.preventDefault();
          ultimo.focus();
        } else if (!e.shiftKey && document.activeElement === ultimo) {
          e.preventDefault();
          primero.focus();
        }
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previamenteEnfocado?.focus();
    };
  }, [empleado, onCerrar]);

  if (!empleado) return null;

  async function confirmarBaja() {
    if (!empleado) return;
    setProcesandoBaja(true);
    setErrorBaja(null);
    const resultado = await darDeBaja(empleado.id);
    setProcesandoBaja(false);
    if (resultado.ok) {
      onCambio?.();
      onCerrar();
    } else {
      setErrorBaja(resultado.error);
    }
  }

  async function confirmarTarjeta() {
    if (!empleado || !uidLeido) return;
    setGuardandoTarjeta(true);
    setErrorTarjeta(null);
    const resultado = await vincularTarjeta(empleado.id, uidLeido);
    setGuardandoTarjeta(false);
    if (resultado.ok) {
      setVinculando(false);
      setUidLeido(null);
      onCambio?.();
    } else {
      setErrorTarjeta(resultado.error);
    }
  }

  const primerNombre = empleado.nombre.trim().split(/\s+/)[0] ?? empleado.nombre;
  const totalMinutos = empleado.semanas.reduce((acc, s) => acc + s.minutos, 0);
  const faltas = empleado.semanas.reduce(
    (acc, s) => acc + s.dias.filter((d) => d.estado === "falta").length,
    0,
  );
  const resumenAsistencia = `${(totalMinutos / 60).toFixed(1)} h · ${faltas} ${faltas === 1 ? "falta" : "faltas"}`;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50 }} data-noprint="">
      <div
        onClick={onCerrar}
        style={{ position: "absolute", inset: 0, background: "oklch(0.24 0.012 70 / 0.28)", animation: "fadein .15s ease" }}
      />
      <aside
        ref={asideRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Ficha de ${empleado.nombre}`}
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          bottom: 0,
          width: 470,
          background: "var(--panel)",
          borderLeft: "1px solid var(--line2)",
          boxShadow: "var(--shadow)",
          overflowY: "auto",
          animation: "slidein .2s cubic-bezier(.2,.8,.2,1)",
        }}
      >
        {/* Encabezado */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "20px 22px 18px 22px", borderBottom: "1px solid var(--line)" }}>
          <div
            style={{
              width: 46,
              height: 46,
              borderRadius: "50%",
              border: "1px solid var(--line2)",
              background: "var(--panel2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "var(--font-mono)",
              fontSize: 14,
              color: "var(--fg2)",
              flex: "none",
            }}
          >
            {initials(empleado.nombre)}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: "-0.01em" }}>{empleado.nombre}</div>
            <div style={{ fontSize: 12, color: "var(--fg2)", marginTop: 2 }}>
              {empleado.puesto} ·{" "}
              {empleado.activo
                ? "Activo"
                : empleado.fechaBaja
                  ? `Baja el ${fechaCorta(empleado.fechaBaja)}`
                  : "Baja"}
            </div>
          </div>
          <button
            onClick={onCerrar}
            style={{
              border: "1px solid var(--line2)",
              background: "transparent",
              color: "var(--fg2)",
              width: 26,
              height: 26,
              borderRadius: 2,
              cursor: "pointer",
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        {/* Tarifa actual + historial */}
        <section style={{ padding: "18px 22px", borderBottom: "1px solid var(--line)" }}>
          <div className="section-label" style={{ marginBottom: 10 }}>
            Tarifa actual
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 28, fontWeight: 600, letterSpacing: "-0.02em" }}>
              {money(empleado.tarifa)}
            </div>
            <div style={{ fontSize: 12.5, color: "var(--fg2)" }}>
              {empleado.unidad === "hora" ? "por hora" : "por día"} · MXN
            </div>
          </div>

          <div className="section-label" style={{ margin: "18px 0 8px 0" }}>
            Historial de cambios
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thStyle("left")}>Fecha</th>
                <th style={thStyle("right")}>Anterior</th>
                <th style={thStyle("right")}>Nueva</th>
                <th style={{ ...thStyle("left"), padding: "0 0 5px 8px" }}>Autorizó</th>
              </tr>
            </thead>
            <tbody>
              {empleado.historial.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ fontSize: 11, color: "var(--fg3)", padding: "8px 0" }}>
                    Sin cambios registrados.
                  </td>
                </tr>
              ) : (
                empleado.historial.map((h, i) => (
                  <tr key={i}>
                    <td style={tdStyle("left", "var(--fg2)", 11)}>{fechaCorta(h.fecha)}</td>
                    <td style={tdStyle("right", "var(--fg3)", 11)}>{h.anterior != null ? money(h.anterior) : "—"}</td>
                    <td style={{ ...tdStyle("right", "var(--fg)", 11.5), fontWeight: 600 }}>{money(h.nueva)}</td>
                    <td style={{ fontSize: 11, color: "var(--fg2)", borderBottom: "1px solid var(--line)", padding: "6px 0 6px 8px" }}>
                      {h.autor}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>

        {/* Tarjeta NFC */}
        <section style={{ padding: "18px 22px", borderBottom: "1px solid var(--line)" }}>
          <div className="section-label" style={{ marginBottom: 10 }}>
            Tarjeta NFC
          </div>

          {vinculando ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, padding: "8px 0" }}>
              {uidLeido ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, animation: "fadein .2s ease" }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: "50%",
                      border: "1px solid var(--ok)",
                      color: "var(--ok)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 15,
                    }}
                  >
                    ✓
                  </div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 600, letterSpacing: "0.06em" }}>
                    {uidLeido}
                  </div>
                  {errorTarjeta && <div style={{ fontSize: 11, color: "var(--neg)" }}>{errorTarjeta}</div>}
                  <div style={{ display: "flex", gap: 8 }}>
                    <button disabled={guardandoTarjeta} onClick={confirmarTarjeta} style={primaryBtnStyle}>
                      {guardandoTarjeta ? "Guardando…" : "Confirmar"}
                    </button>
                    <button
                      onClick={() => {
                        setVinculando(false);
                        setUidLeido(null);
                        setErrorTarjeta(null);
                      }}
                      style={ghostBtnStyle}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                  <div style={{ position: "relative", width: 54, height: 54, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        border: "1px solid var(--accent)",
                        borderRadius: "50%",
                        animation: "pulsering 1.8s ease-out infinite",
                      }}
                    />
                    <div style={{ width: 32, height: 20, border: "1.5px solid var(--fg2)", borderRadius: 3 }} />
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--fg2)" }}>Esperando lectura en la tablet de recepción…</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    {/* TODO: sustituir por lectura real vía Web NFC API (NDEFReader)
                        cuando haya un lector conectado. Ver src/components/personal/nfc.ts */}
                    <button onClick={() => setUidLeido(generarUidSimulado())} style={ghostBtnStyle}>
                      simular lectura
                    </button>
                    <button onClick={() => setVinculando(false)} style={ghostBtnStyle}>
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : empleado.uid ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                border: "1px solid var(--line2)",
                borderRadius: 3,
                padding: "11px 13px",
              }}
            >
              <div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 500, letterSpacing: "0.04em" }}>
                  {empleado.uid}
                </div>
                <div style={{ fontSize: 11, color: "var(--fg2)", marginTop: 3 }}>
                  Asignada el {fechaCorta(empleado.tarjetaAsignadaEn ?? empleado.fechaIngreso)}
                </div>
              </div>
              <button
                className={styles.reponerBtn}
                onClick={() => setVinculando(true)}
                style={{ borderRadius: 3, height: 28, padding: "0 11px", fontSize: 12, cursor: "pointer" }}
              >
                Reponer tarjeta
              </button>
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                border: "1px solid var(--warn)",
                background: "var(--warn-soft)",
                borderRadius: 3,
                padding: "11px 13px",
              }}
            >
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 500, color: "var(--warn)" }}>Sin tarjeta asignada</div>
                <div style={{ fontSize: 11, color: "var(--fg2)", marginTop: 3 }}>No puede registrar asistencia en la tablet.</div>
              </div>
              <button
                onClick={() => setVinculando(true)}
                style={{
                  border: "1px solid var(--warn)",
                  background: "transparent",
                  color: "var(--warn)",
                  borderRadius: 3,
                  height: 28,
                  padding: "0 11px",
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                Vincular tarjeta
              </button>
            </div>
          )}
        </section>

        {/* Asistencia */}
        <section style={{ padding: "18px 22px", borderBottom: "1px solid var(--line)" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
            <div className="section-label">Asistencia · 4 semanas</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--fg2)" }}>{resumenAsistencia}</div>
          </div>
          <div style={{ display: "flex", gap: 14 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {empleado.semanas.map((semana, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, color: "var(--fg3)", width: 44 }}>
                    {semana.label}
                  </div>
                  <div style={{ display: "flex", gap: 3 }}>
                    {semana.dias.map((dia, j) => {
                      const est = estiloDia(dia.estado);
                      return (
                        <div
                          key={j}
                          title={`${fechaCorta(dia.fecha)} · ${etiquetaEstado(dia.estado)}`}
                          style={{ width: 17, height: 17, borderRadius: 2, border: `1px solid ${est.borde}`, background: est.fondo }}
                        />
                      );
                    })}
                  </div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--fg2)", marginLeft: 4 }}>
                    {(semana.minutos / 60).toFixed(1)} h
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", gap: 14, marginTop: 12, fontFamily: "var(--font-mono)", fontSize: 9.5, color: "var(--fg3)" }}>
            <span>■ completo</span>
            <span>◪ incompleto</span>
            <span>□ falta</span>
            <span>· descanso</span>
          </div>
        </section>

        {/* Conceptos recurrentes */}
        <section style={{ padding: "18px 22px", borderBottom: "1px solid var(--line)" }}>
          <div className="section-label" style={{ marginBottom: 10 }}>
            Conceptos recurrentes
          </div>
          {empleado.conceptos.length === 0 ? (
            <div style={{ fontSize: 11.5, color: "var(--fg2)" }}>Sin conceptos recurrentes.</div>
          ) : (
            empleado.conceptos.map((c) => (
              <div
                key={c.id}
                style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "center", padding: "9px 0", borderBottom: "1px solid var(--line)" }}
              >
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 500 }}>{c.descripcion}</div>
                  <div style={{ fontSize: 11, color: "var(--fg2)", marginTop: 2 }}>{conceptoDetalle(c)}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 600 }}>{money(conceptoMonto(c))}</div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, color: "var(--fg3)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                    {conceptoTag(c)}
                  </div>
                </div>
              </div>
            ))
          )}
        </section>

        {/* Zona de riesgo */}
        <section style={{ padding: "18px 22px 26px 22px" }}>
          <div className="section-label" style={{ color: "var(--neg)", marginBottom: 10 }}>
            Zona de riesgo
          </div>
          <div style={{ border: "1px solid var(--line2)", borderRadius: 3, padding: 13 }}>
            {confirmandoBaja ? (
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 500 }}>¿Dar de baja a {primerNombre}?</div>
                <div style={{ fontSize: 11.5, color: "var(--fg2)", lineHeight: 1.5, marginTop: 5 }}>
                  Se libera su tarjeta NFC y deja de aparecer en la nómina semanal. El historial de pagos se
                  conserva.
                </div>
                {errorBaja && <div style={{ fontSize: 11, color: "var(--neg)", marginTop: 8 }}>{errorBaja}</div>}
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  <button
                    disabled={procesandoBaja}
                    onClick={confirmarBaja}
                    style={{
                      border: "1px solid var(--neg)",
                      background: "var(--neg)",
                      color: "var(--panel)",
                      borderRadius: 3,
                      height: 28,
                      padding: "0 12px",
                      fontSize: 12,
                      fontWeight: 500,
                      cursor: "pointer",
                    }}
                  >
                    {procesandoBaja ? "Procesando…" : "Sí, dar de baja"}
                  </button>
                  <button
                    onClick={() => {
                      setConfirmandoBaja(false);
                      setErrorBaja(null);
                    }}
                    style={{ border: "1px solid var(--line2)", background: "transparent", borderRadius: 3, height: 28, padding: "0 12px", fontSize: 12, cursor: "pointer" }}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <div style={{ fontSize: 11.5, color: "var(--fg2)", lineHeight: 1.5 }}>
                  Quita al empleado de la nómina y libera su tarjeta.
                </div>
                <button
                  onClick={() => setConfirmandoBaja(true)}
                  disabled={!empleado.activo}
                  style={{
                    border: "1px solid var(--neg)",
                    background: "transparent",
                    color: "var(--neg)",
                    borderRadius: 3,
                    height: 28,
                    padding: "0 12px",
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: empleado.activo ? "pointer" : "default",
                    opacity: empleado.activo ? 1 : 0.5,
                    whiteSpace: "nowrap",
                  }}
                >
                  Dar de baja
                </button>
              </div>
            )}
          </div>
        </section>
      </aside>
    </div>
  );
}
