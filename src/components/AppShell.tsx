"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import type {
  EmpleadoDetalle,
  EmpleadoRow,
  NominaPeriodo,
  PeriodoRow,
} from "@/lib/contracts";
import { getTheme, toggleTheme, type Theme } from "@/lib/theme";
import { obtenerFicha, obtenerNomina, refrescarEmpleados } from "@/app/datos";
import { cerrarSesion } from "@/app/login/actions";
import TablaPersonal from "@/components/personal/TablaPersonal";
import FichaEmpleado from "@/components/personal/FichaEmpleado";
import WizardAlta from "@/components/personal/WizardAlta";
import PanelCierre from "@/components/cierre/PanelCierre";
import SelectorSemana from "@/components/cierre/SelectorSemana";

type Tab = "personal" | "cierre";
type Filtro = "Activos" | "Inactivos" | "Todos";

const FILTROS: Filtro[] = ["Activos", "Inactivos", "Todos"];

export default function AppShell({
  empleadosIniciales,
  periodos,
  nominaInicial,
}: {
  empleadosIniciales: EmpleadoRow[];
  periodos: PeriodoRow[];
  nominaInicial: NominaPeriodo | null;
}) {
  const [tab, setTab] = useState<Tab>("personal");
  const [empleados, setEmpleados] = useState(empleadosIniciales);
  const [query, setQuery] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("Activos");

  const [ficha, setFicha] = useState<EmpleadoDetalle | null>(null);
  const [wizard, setWizard] = useState(false);

  const [nomina, setNomina] = useState(nominaInicial);
  const [periodoId, setPeriodoId] = useState(nominaInicial?.periodo.id ?? null);

  const [tema, setTema] = useState<Theme>("light");
  const [, startTransition] = useTransition();

  useEffect(() => setTema(getTheme()), []);

  const recargar = useCallback(() => {
    startTransition(async () => {
      setEmpleados(await refrescarEmpleados());
    });
  }, []);

  const abrirFicha = useCallback((id: number) => {
    startTransition(async () => setFicha(await obtenerFicha(id)));
  }, []);

  const cambiarPeriodo = useCallback((id: number) => {
    setPeriodoId(id);
    startTransition(async () => setNomina(await obtenerNomina(id)));
  }, []);

  // La búsqueda y el filtro viven aquí; la tabla recibe la lista ya filtrada.
  const visibles = useMemo(() => {
    const porEstado = empleados.filter((e) =>
      filtro === "Todos" ? true : filtro === "Activos" ? e.activo : !e.activo,
    );
    const q = query.trim().toLowerCase();
    if (!q) return porEstado;
    return porEstado.filter(
      (e) =>
        e.nombre.toLowerCase().includes(q) || e.puesto.toLowerCase().includes(q),
    );
  }, [empleados, query, filtro]);

  const activos = empleados.filter((e) => e.activo).length;
  const sinTarjeta = empleados.filter((e) => e.activo && !e.uid).length;
  const periodoActual = periodos.find((p) => p.id === periodoId) ?? periodos[0];

  const contador =
    tab === "cierre" && nomina
      ? `${nomina.filas.length} empleados`
      : `${activos} empleados activos · ${sinTarjeta} sin tarjeta`;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--fg)", fontSize: 13 }}>
      <div style={{ display: "flex", flexDirection: "column", height: "100vh", minHeight: 760 }}>
        <header
          style={{
            display: "grid",
            gridTemplateColumns: "auto 1fr auto",
            alignItems: "center",
            gap: 24,
            padding: "14px 24px",
            borderBottom: "1px solid var(--line)",
            background: "var(--panel)",
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", gap: 18 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 16 }}>
              {([["personal", "Personal"], ["cierre", "Cierre de nómina"]] as const).map(
                ([id, label]) => (
                  <button
                    key={id}
                    onClick={() => setTab(id)}
                    style={{
                      border: 0,
                      background: "transparent",
                      padding: "2px 0 4px 0",
                      fontSize: 16,
                      fontWeight: 600,
                      letterSpacing: "-0.01em",
                      cursor: "pointer",
                      color: tab === id ? "var(--fg)" : "var(--fg3)",
                      borderBottom: `2px solid ${tab === id ? "var(--fg)" : "transparent"}`,
                    }}
                  >
                    {label}
                  </button>
                ),
              )}
            </div>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11.5,
                color: "var(--fg2)",
                letterSpacing: "0.01em",
              }}
            >
              {contador}
            </div>
          </div>

          <div style={{ justifySelf: "start" }} data-noprint="">
            {tab === "personal" ? (
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    border: "1px solid var(--line2)",
                    borderRadius: 3,
                    background: "var(--panel)",
                    padding: "0 10px",
                    height: 30,
                    width: 260,
                  }}
                >
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg3)" }}>⌕</span>
                  <input
                    type="text"
                    placeholder="Buscar por nombre"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    style={{ border: 0, outline: 0, background: "transparent", width: "100%", fontSize: 12.5, padding: 0 }}
                  />
                </div>
                <div style={{ display: "flex", border: "1px solid var(--line2)", borderRadius: 3, overflow: "hidden", height: 30 }}>
                  {FILTROS.map((f, i) => (
                    <button
                      key={f}
                      onClick={() => setFiltro(f)}
                      style={{
                        border: 0,
                        borderLeft: i === 0 ? "none" : "1px solid var(--line)",
                        background: filtro === f ? "var(--fg)" : "var(--panel)",
                        color: filtro === f ? "var(--panel)" : "var(--fg2)",
                        padding: "0 12px",
                        height: "100%",
                        fontSize: 12,
                        fontWeight: 500,
                        cursor: "pointer",
                      }}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>
            ) : periodoActual ? (
              <SelectorSemana periodos={periodos} actual={periodoActual} onCambiar={cambiarPeriodo} />
            ) : null}
          </div>

          <button
            data-noprint=""
            onClick={() => (tab === "personal" ? setWizard(true) : window.print())}
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
              letterSpacing: "0.005em",
            }}
          >
            {tab === "personal" ? "Agregar empleado" : "Exportar nómina"}
          </button>
        </header>

        {tab === "personal" ? (
          <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", padding: "0 24px" }}>
            <TablaPersonal
              empleados={visibles}
              query={query}
              onAbrirFicha={abrirFicha}
              onVincularTarjeta={abrirFicha}
              onDarDeBaja={abrirFicha}
              onLimpiarBusqueda={() => setQuery("")}
              onAgregarEmpleado={() => setWizard(true)}
              onCambio={recargar}
            />
          </div>
        ) : nomina ? (
          <div style={{ flex: 1, overflowY: "auto", padding: "0 24px 28px 24px" }}>
            <PanelCierre
              nomina={nomina}
              periodos={periodos}
              onCambiarPeriodo={cambiarPeriodo}
              onRevisar={() => setTab("personal")}
              onCerrado={() => periodoId && cambiarPeriodo(periodoId)}
            />
          </div>
        ) : (
          <div style={{ flex: 1, display: "grid", placeItems: "center", color: "var(--fg2)", fontSize: 12.5 }}>
            No hay periodos de nómina registrados.
          </div>
        )}

        <footer
          data-noprint=""
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            padding: "8px 24px",
            borderTop: "1px solid var(--line)",
            background: "var(--panel)",
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            color: "var(--fg3)",
            letterSpacing: "0.04em",
          }}
        >
          <span style={{ textTransform: "uppercase" }}>Nómina · MXN</span>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => setTema(toggleTheme())}
              style={botonFooter}
            >
              {tema === "dark" ? "modo claro" : "modo oscuro"}
            </button>
            <form action={cerrarSesion}>
              <button type="submit" style={botonFooter}>cerrar sesión</button>
            </form>
          </div>
        </footer>
      </div>

      <FichaEmpleado empleado={ficha} onCerrar={() => setFicha(null)} onCambio={recargar} />
      <WizardAlta
        abierto={wizard}
        onCerrar={() => setWizard(false)}
        onCreado={() => {
          setWizard(false);
          recargar();
        }}
      />
    </div>
  );
}

const botonFooter: React.CSSProperties = {
  border: "1px solid var(--line2)",
  background: "transparent",
  color: "var(--fg2)",
  borderRadius: 2,
  padding: "2px 8px",
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  cursor: "pointer",
};
