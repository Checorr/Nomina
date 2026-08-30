"use client";

import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, KeyboardEvent } from "react";
import type { EmpleadoRow, Unidad } from "@/lib/contracts";
import { money, initials, fechaCorta, unidadLabel } from "@/lib/format";
import { actualizarTarifa } from "@/app/actions";
import styles from "./personal.module.css";

const GRID_COLUMNS = "minmax(240px,1fr) 168px 152px 104px 132px 34px";

type EstadoGuardado = "saving" | "ok" | "error" | undefined;

type TablaPersonalProps = {
  empleados: EmpleadoRow[];
  /**
   * Texto de búsqueda activo en la cabecera de la app. No forma parte del
   * contrato mínimo indicado (`{ empleados: EmpleadoRow[] }`), pero es
   * necesario para distinguir los dos estados vacíos del prototipo: lista
   * vacía real vs. "sin resultados de búsqueda". Opcional para no romper el
   * uso mínimo documentado.
   */
  query?: string;
  onAbrirFicha: (id: number) => void;
  onVincularTarjeta: (id: number) => void;
  onDarDeBaja: (id: number) => void;
  onLimpiarBusqueda: () => void;
  onAgregarEmpleado: () => void;
  /** Se invoca tras guardar una tarifa con éxito, para que el padre pueda
   * refrescar su copia de la lista de empleados. */
  onCambio?: () => void;
};

/**
 * Traduce la última checada a lenguaje humano, replicando los ejemplos del
 * prototipo: "hoy 08:57", "ayer 18:22", "hace 3 días", o la fecha corta si
 * es más vieja.
 *
 * El prototipo solo da ejemplos puntuales, no un corte exacto entre
 * "hace N días" y la fecha corta. Se eligió 6 días como último día que se
 * expresa en relativo (una semana natural) y fecha corta desde el día 7;
 * es una interpretación, no un valor literal del prototipo.
 */
function formatUltimaChecada(iso: string | null): string {
  if (!iso) return "sin checadas";
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return "sin checadas";

  const ahora = new Date();
  const inicioDia = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDias = Math.round((inicioDia(ahora) - inicioDia(fecha)) / 86_400_000);

  const hh = String(fecha.getHours()).padStart(2, "0");
  const mm = String(fecha.getMinutes()).padStart(2, "0");

  if (diffDias === 0) return `hoy ${hh}:${mm}`;
  if (diffDias === 1) return `ayer ${hh}:${mm}`;
  if (diffDias >= 2 && diffDias <= 6) return `hace ${diffDias} días`;
  return fechaCorta(fecha);
}

export default function TablaPersonal({
  empleados,
  query = "",
  onAbrirFicha,
  onVincularTarjeta,
  onDarDeBaja,
  onLimpiarBusqueda,
  onAgregarEmpleado,
  onCambio,
}: TablaPersonalProps) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [draftUnit, setDraftUnit] = useState<Unidad>("hora");
  const [saveState, setSaveState] = useState<Record<number, EstadoGuardado>>({});
  const [overrides, setOverrides] = useState<Record<number, { tarifa: number; unidad: Unidad }>>({});
  const [lastAttempt, setLastAttempt] = useState<Record<number, { tarifa: number; unidad: Unidad }>>({});
  const [menuOpenId, setMenuOpenId] = useState<number | null>(null);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const suppressBlurRef = useRef(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const timersRef = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    if (editingId !== null) inputRef.current?.focus();
  }, [editingId]);

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      Object.values(timers).forEach(clearTimeout);
    };
  }, []);

  // Cerrar el popover de menú al hacer clic fuera o presionar Escape.
  useEffect(() => {
    if (menuOpenId === null) return;
    function onDocClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpenId(null);
      }
    }
    function onKeyDown(e: globalThis.KeyboardEvent) {
      if (e.key === "Escape") setMenuOpenId(null);
    }
    document.addEventListener("click", onDocClick, true);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("click", onDocClick, true);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpenId]);

  function startEdit(emp: EmpleadoRow) {
    const actual = overrides[emp.id] ?? { tarifa: emp.tarifa, unidad: emp.unidad };
    setDraft(actual.tarifa.toFixed(2));
    setDraftUnit(actual.unidad);
    setEditingId(emp.id);
    setMenuOpenId(null);
  }

  function cancelEdit() {
    suppressBlurRef.current = true;
    setEditingId(null);
  }

  async function guardarTarifa(id: number, tarifa: number, unidad: Unidad) {
    setLastAttempt((s) => ({ ...s, [id]: { tarifa, unidad } }));
    setSaveState((s) => ({ ...s, [id]: "saving" }));
    try {
      const resultado = await actualizarTarifa(id, tarifa, unidad);
      if (resultado.ok) {
        setOverrides((s) => ({ ...s, [id]: { tarifa, unidad } }));
        setSaveState((s) => ({ ...s, [id]: "ok" }));
        onCambio?.();
        clearTimeout(timersRef.current[id]);
        timersRef.current[id] = setTimeout(() => {
          setSaveState((s) => ({ ...s, [id]: undefined }));
        }, 1800);
      } else {
        setSaveState((s) => ({ ...s, [id]: "error" }));
      }
    } catch {
      setSaveState((s) => ({ ...s, [id]: "error" }));
    }
  }

  function commit(id: number) {
    suppressBlurRef.current = true;
    setEditingId(null);
    const parsed = parseFloat(draft.replace(/[^0-9.]/g, ""));
    if (Number.isNaN(parsed)) return;
    void guardarTarifa(id, parsed, draftUnit);
  }

  // El blur se ata al contenedor de input+select (no a cada control) para
  // que moverse del input al select con Tab no dispare un guardado
  // prematuro con la unidad todavía sin cambiar.
  function handleGroupBlur(id: number, e: React.FocusEvent<HTMLDivElement>) {
    if (suppressBlurRef.current) {
      suppressBlurRef.current = false;
      return;
    }
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
      commit(id);
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement | HTMLSelectElement>, id: number) {
    if (e.key === "Enter") commit(id);
    else if (e.key === "Escape") cancelEdit();
  }

  const isEmpty = empleados.length === 0 && query.trim() === "";
  const isNoResults = empleados.length === 0 && query.trim() !== "";

  return (
    <div style={{ flex: 1, minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: GRID_COLUMNS,
          gap: 16,
          alignItems: "end",
          padding: "14px 8px 7px 8px",
          borderBottom: "1px solid var(--line2)",
          fontFamily: "var(--font-mono)",
          fontSize: 9.5,
          letterSpacing: "0.11em",
          textTransform: "uppercase",
          color: "var(--fg3)",
        }}
      >
        <div>Empleado</div>
        <div style={{ textAlign: "right" }}>Tarifa</div>
        <div>Tarjeta NFC</div>
        <div>Ingreso</div>
        <div>Última checada</div>
        <div />
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        {empleados.map((emp) => {
          const overridden = overrides[emp.id];
          const tarifa = overridden?.tarifa ?? emp.tarifa;
          const unidad = overridden?.unidad ?? emp.unidad;
          const editing = editingId === emp.id;
          const estado = saveState[emp.id];
          const menuAbierto = menuOpenId === emp.id;

          return (
            <div
              key={emp.id}
              style={{
                display: "grid",
                gridTemplateColumns: GRID_COLUMNS,
                gap: 16,
                alignItems: "center",
                padding: "0 8px",
                height: 44,
                borderBottom: "1px solid var(--line)",
                opacity: emp.activo ? 1 : 0.58,
              }}
            >
              {/* Empleado */}
              <div
                onClick={() => onAbrirFicha(emp.id)}
                style={{ display: "flex", alignItems: "center", gap: 11, cursor: "pointer", minWidth: 0 }}
              >
                <div
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: "50%",
                    border: "1px solid var(--line2)",
                    background: "var(--panel2)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: "var(--font-mono)",
                    fontSize: 9.5,
                    fontWeight: 500,
                    color: "var(--fg2)",
                    flex: "none",
                  }}
                >
                  {initials(emp.nombre)}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 500,
                        letterSpacing: "-0.005em",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {emp.nombre}
                    </div>
                    {!emp.activo && (
                      <span
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: 8.5,
                          letterSpacing: "0.09em",
                          textTransform: "uppercase",
                          border: "1px solid var(--line2)",
                          color: "var(--fg2)",
                          padding: "1px 4px",
                          borderRadius: 2,
                          flex: "none",
                        }}
                      >
                        Baja
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--fg2)", marginTop: 1 }}>{emp.puesto}</div>
                </div>
              </div>

              {/* Tarifa */}
              <div style={{ textAlign: "right" }}>
                {editing ? (
                  <div
                    style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 5 }}
                    onBlur={(e) => handleGroupBlur(emp.id, e)}
                  >
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--fg3)" }}>$</span>
                    <input
                      ref={inputRef}
                      value={draft}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => setDraft(e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, emp.id)}
                      style={{
                        width: 62,
                        border: "1px solid var(--accent)",
                        outline: "2px solid var(--accent-soft)",
                        borderRadius: 2,
                        background: "var(--panel)",
                        fontFamily: "var(--font-mono)",
                        fontSize: 13,
                        fontWeight: 500,
                        textAlign: "right",
                        padding: "2px 5px",
                      }}
                    />
                    <select
                      value={draftUnit}
                      onChange={(e: ChangeEvent<HTMLSelectElement>) => setDraftUnit(e.target.value as Unidad)}
                      onKeyDown={(e) => handleKeyDown(e, emp.id)}
                      style={{
                        border: "1px solid var(--line2)",
                        borderRadius: 2,
                        background: "var(--panel)",
                        fontSize: 11,
                        padding: "2px 2px",
                      }}
                    >
                      <option value="hora">/ hora</option>
                      <option value="dia">/ día</option>
                    </select>
                  </div>
                ) : (
                  <>
                    <div
                      onClick={() => startEdit(emp)}
                      title="Clic para editar"
                      className={styles.rateTrigger}
                      style={{
                        display: "inline-flex",
                        alignItems: "baseline",
                        justifyContent: "flex-end",
                        gap: 5,
                        cursor: "text",
                        padding: "3px 6px",
                        marginRight: -6,
                        borderRadius: 2,
                      }}
                    >
                      <span
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: 13.5,
                          fontWeight: 600,
                          letterSpacing: "-0.01em",
                        }}
                      >
                        {money(tarifa)}
                      </span>
                      <span style={{ fontSize: 10.5, color: "var(--fg2)", whiteSpace: "nowrap" }}>
                        {unidadLabel(unidad)}
                      </span>
                    </div>
                    {estado === "saving" && (
                      <div
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: 9.5,
                          color: "var(--fg3)",
                          letterSpacing: "0.06em",
                          marginTop: -2,
                          textAlign: "right",
                        }}
                      >
                        guardando…
                      </div>
                    )}
                    {estado === "ok" && (
                      <div
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: 9.5,
                          color: "var(--ok)",
                          letterSpacing: "0.06em",
                          marginTop: -2,
                          textAlign: "right",
                          animation: "fadein .18s ease",
                        }}
                      >
                        ✓ guardado
                      </div>
                    )}
                    {estado === "error" && (
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6, marginTop: -2 }}>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, color: "var(--neg)", letterSpacing: "0.04em" }}>
                          no se guardó
                        </span>
                        <button
                          onClick={() => {
                            const attempt = lastAttempt[emp.id];
                            if (attempt) void guardarTarifa(emp.id, attempt.tarifa, attempt.unidad);
                          }}
                          style={{
                            border: "1px solid var(--neg)",
                            background: "transparent",
                            color: "var(--neg)",
                            borderRadius: 2,
                            fontSize: 9.5,
                            padding: "0 4px",
                            cursor: "pointer",
                          }}
                        >
                          Reintentar
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Tarjeta NFC */}
              <div>
                {emp.uid ? (
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg2)", letterSpacing: "0.02em" }}>
                    {emp.uid}
                  </div>
                ) : (
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      border: "1px solid var(--warn)",
                      background: "var(--warn-soft)",
                      color: "var(--warn)",
                      borderRadius: 2,
                      padding: "2px 7px",
                    }}
                  >
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 600 }}>!</span>
                    <span style={{ fontSize: 11, fontWeight: 500 }}>Sin tarjeta</span>
                  </div>
                )}
              </div>

              {/* Ingreso */}
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg2)" }}>
                {fechaCorta(emp.fechaIngreso)}
              </div>

              {/* Última checada */}
              <div style={{ fontSize: 11.5, color: "var(--fg2)" }}>{formatUltimaChecada(emp.ultimaChecada)}</div>

              {/* Menú */}
              <div
                data-noprint=""
                style={{ position: "relative", textAlign: "right" }}
                ref={menuAbierto ? menuRef : undefined}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpenId(menuAbierto ? null : emp.id);
                  }}
                  className={styles.menuButton}
                  style={{
                    background: "transparent",
                    color: "var(--fg2)",
                    width: 26,
                    height: 24,
                    borderRadius: 2,
                    cursor: "pointer",
                    fontSize: 14,
                    lineHeight: 1,
                  }}
                >
                  ⋯
                </button>
                {menuAbierto && (
                  <div
                    style={{
                      position: "absolute",
                      top: 26,
                      right: 0,
                      zIndex: 30,
                      width: 176,
                      background: "var(--panel)",
                      border: "1px solid var(--line2)",
                      borderRadius: 3,
                      boxShadow: "var(--shadow)",
                      padding: 4,
                      textAlign: "left",
                      animation: "fadein .12s ease",
                    }}
                  >
                    <button
                      className={styles.menuItem}
                      onClick={() => {
                        setMenuOpenId(null);
                        onAbrirFicha(emp.id);
                      }}
                    >
                      Ver ficha
                    </button>
                    <button
                      className={styles.menuItem}
                      onClick={() => startEdit(emp)}
                    >
                      Editar tarifa
                    </button>
                    <button
                      className={styles.menuItem}
                      onClick={() => {
                        setMenuOpenId(null);
                        onVincularTarjeta(emp.id);
                      }}
                    >
                      {emp.uid ? "Reponer tarjeta" : "Vincular tarjeta"}
                    </button>
                    <div style={{ height: 1, background: "var(--line)", margin: "4px 0" }} />
                    <button
                      className={styles.menuItem}
                      style={{ color: "var(--neg)" }}
                      onClick={() => {
                        setMenuOpenId(null);
                        onDarDeBaja(emp.id);
                      }}
                    >
                      Dar de baja
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {isEmpty && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 14,
              padding: "120px 20px",
              textAlign: "center",
            }}
          >
            <div style={{ width: 44, height: 44, border: "1px dashed var(--line2)", borderRadius: "50%" }} />
            <div style={{ fontSize: 15, fontWeight: 500 }}>Aún no hay empleados registrados</div>
            <div style={{ fontSize: 12.5, color: "var(--fg2)", maxWidth: 380, lineHeight: 1.5 }}>
              Da de alta al primer empleado para asignarle tarifa y tarjeta NFC. Sin tarjeta vinculada no podrá
              checar en la tablet.
            </div>
            <button
              onClick={onAgregarEmpleado}
              style={{
                border: "1px solid var(--accent)",
                background: "var(--accent)",
                color: "var(--panel)",
                height: 30,
                padding: "0 14px",
                borderRadius: 3,
                fontSize: 12.5,
                fontWeight: 500,
                cursor: "pointer",
                marginTop: 4,
              }}
            >
              Agregar empleado
            </button>
          </div>
        )}

        {isNoResults && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              padding: "110px 20px",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 500 }}>Sin resultados para «{query}»</div>
            <div style={{ fontSize: 12.5, color: "var(--fg2)" }}>Revisa la ortografía o cambia el filtro de estado.</div>
            <button
              onClick={onLimpiarBusqueda}
              style={{
                border: "1px solid var(--line2)",
                background: "var(--panel)",
                height: 28,
                padding: "0 12px",
                borderRadius: 3,
                fontSize: 12,
                cursor: "pointer",
                marginTop: 4,
              }}
            >
              Limpiar búsqueda
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
