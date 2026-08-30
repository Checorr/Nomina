"use client";

import type { PeriodoRow } from "@/lib/contracts";
import { rangoSemana } from "./formatoCierre";
import styles from "./SelectorSemana.module.css";

type SelectorSemanaProps = {
  periodos: PeriodoRow[];
  actual: PeriodoRow;
  onCambiar: (id: number) => void;
};

/**
 * Controles "‹ semana ›" del encabezado de la pestaña Cierre, más la
 * píldora de estado (Abierta/Cerrada) del periodo actual.
 */
export default function SelectorSemana({ periodos, actual, onCambiar }: SelectorSemanaProps) {
  const idx = periodos.findIndex((p) => p.id === actual.id);
  const anterior = idx > 0 ? periodos[idx - 1] : null;
  const siguiente = idx >= 0 && idx < periodos.length - 1 ? periodos[idx + 1] : null;

  const estadoLabel = actual.estado === "abierto" ? "Abierta" : "Cerrada";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          border: "1px solid var(--line2)",
          borderRadius: 3,
          height: 30,
          overflow: "hidden",
        }}
      >
        <button
          type="button"
          onClick={() => anterior && onCambiar(anterior.id)}
          disabled={!anterior}
          className={styles.navButton}
          style={{ borderRight: "1px solid var(--line)" }}
          aria-label="Semana anterior"
        >
          ‹
        </button>
        <div className="mono" style={{ fontSize: 11.5, padding: "0 12px" }}>
          {rangoSemana(actual)}
        </div>
        <button
          type="button"
          onClick={() => siguiente && onCambiar(siguiente.id)}
          disabled={!siguiente}
          className={styles.navButton}
          style={{ borderLeft: "1px solid var(--line)" }}
          aria-label="Semana siguiente"
        >
          ›
        </button>
      </div>
      <div
        className="mono"
        style={{
          fontSize: 10,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--fg3)",
          border: "1px solid var(--line2)",
          borderRadius: 2,
          padding: "4px 8px",
        }}
      >
        {estadoLabel}
      </div>
    </div>
  );
}
