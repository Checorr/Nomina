"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { Unidad } from "@/lib/contracts";
import { shortName } from "@/lib/format";
import { crearEmpleado } from "@/app/actions";
import { generarUidSimulado } from "./nfc";

const PUESTOS = ["Almacén", "Producción", "Ventas", "Chofer", "Limpieza"] as const;
const PASOS = ["Datos del empleado", "Tarifa e ingreso", "Foto", "Vinculación de tarjeta"] as const;

function hoyISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type WizardAltaProps = {
  abierto: boolean;
  onCerrar: () => void;
  onCreado: (id: number) => void;
};

export default function WizardAlta({ abierto, onCerrar, onCreado }: WizardAltaProps) {
  const [paso, setPaso] = useState(0);
  const [nombre, setNombre] = useState("");
  const [puesto, setPuesto] = useState<string>(PUESTOS[0]);
  // El usuario paga por día: a diferencia del prototipo (que arrancaba en
  // "hora"), la unidad viene preseleccionada en "Por día".
  const [unidad, setUnidad] = useState<Unidad>("dia");
  const [monto, setMonto] = useState("400.00");
  const [fechaIngreso, setFechaIngreso] = useState(hoyISO());
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [uid, setUid] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const primerInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Reinicia el formulario cada vez que se abre el wizard.
  useEffect(() => {
    if (!abierto) return;
    setPaso(0);
    setNombre("");
    setPuesto(PUESTOS[0]);
    setUnidad("dia");
    setMonto("400.00");
    setFechaIngreso(hoyISO());
    setFotoUrl(null);
    setUid(null);
    setGuardando(false);
    setError(null);
  }, [abierto]);

  useEffect(() => {
    if (abierto && paso === 0) primerInputRef.current?.focus();
  }, [abierto, paso]);

  useEffect(() => {
    if (!abierto) return;
    function onKeyDown(e: globalThis.KeyboardEvent) {
      if (e.key === "Escape") onCerrar();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [abierto, onCerrar]);

  useEffect(() => {
    return () => {
      if (fotoUrl) URL.revokeObjectURL(fotoUrl);
    };
  }, [fotoUrl]);

  if (!abierto) return null;

  const nombreValido = nombre.trim().length > 0;
  const montoNumero = parseFloat(monto.replace(/[^0-9.]/g, ""));
  const montoValido = !Number.isNaN(montoNumero) && montoNumero > 0;

  const rateHint =
    unidad === "hora"
      ? "Rango habitual en la empresa: $45.00 – $90.00 por hora."
      : "Rango habitual en la empresa: $300.00 – $650.00 por día.";

  async function avanzar() {
    if (paso === 0) {
      if (!nombreValido) return;
      setPaso(1);
      return;
    }
    if (paso === 1) {
      if (!montoValido) return;
      setPaso(2);
      return;
    }
    if (paso === 2) {
      setPaso(3);
      return;
    }
    // Paso 3: guardar.
    if (!uid || guardando) return;
    setGuardando(true);
    setError(null);
    const resultado = await crearEmpleado({
      nombre: nombre.trim(),
      puesto,
      tarifa: montoNumero,
      unidad,
      fechaIngreso,
      uid,
    });
    setGuardando(false);
    if (resultado.ok) {
      onCreado(resultado.data.id);
    } else {
      setError(resultado.error);
    }
  }

  function retroceder() {
    if (paso === 0) {
      onCerrar();
      return;
    }
    setPaso((p) => p - 1);
  }

  function onFotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (fotoUrl) URL.revokeObjectURL(fotoUrl);
    setFotoUrl(URL.createObjectURL(file));
    // NOTA: `NuevoEmpleado` (contracts.ts) no acepta todavía una foto — esta
    // previsualización es solo local, hasta que exista un endpoint de carga
    // y un campo en el contrato para persistirla.
  }

  const nextLabel = paso < 3 ? "Continuar" : guardando ? "Guardando…" : uid ? "Guardar empleado" : "Esperando tarjeta…";
  const nextDisabled =
    (paso === 0 && !nombreValido) || (paso === 1 && !montoValido) || (paso === 3 && (!uid || guardando));

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center" }}
      data-noprint=""
    >
      <div
        onClick={onCerrar}
        style={{ position: "absolute", inset: 0, background: "oklch(0.24 0.012 70 / 0.34)", animation: "fadein .15s ease" }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Alta de empleado"
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "relative",
          width: 520,
          background: "var(--panel)",
          border: "1px solid var(--line2)",
          borderRadius: 4,
          boxShadow: "var(--shadow)",
          animation: "fadein .18s ease",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid var(--line)" }}>
          <div>
            <div style={{ fontSize: 14.5, fontWeight: 600 }}>Alta de empleado</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg3)", letterSpacing: "0.06em", marginTop: 3 }}>
              Paso {paso + 1} de 4 · {PASOS[paso]}
            </div>
          </div>
          <button
            onClick={onCerrar}
            style={{ border: "1px solid var(--line2)", background: "transparent", color: "var(--fg2)", width: 26, height: 26, borderRadius: 2, cursor: "pointer", lineHeight: 1 }}
          >
            ✕
          </button>
        </div>

        <div style={{ display: "flex", gap: 4, padding: "12px 20px 0 20px" }}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} style={{ flex: 1, height: 2, background: i <= paso ? "var(--fg)" : "var(--line)" }} />
          ))}
        </div>

        <div style={{ padding: 20, minHeight: 242 }}>
          {paso === 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={labelStyle}>Nombre completo</label>
                <input
                  ref={primerInputRef}
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Ej. María Fernanda Rosales Gómez"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Puesto</label>
                <select value={puesto} onChange={(e) => setPuesto(e.target.value)} style={inputStyle}>
                  {PUESTOS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {paso === 1 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={labelStyle}>Tarifa</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, border: "1px solid var(--line2)", borderRadius: 3, height: 34, padding: "0 10px", flex: 1 }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--fg3)" }}>$</span>
                    <input
                      value={monto}
                      onChange={(e) => setMonto(e.target.value)}
                      style={{ border: 0, outline: 0, background: "transparent", width: "100%", fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 600 }}
                    />
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--fg3)" }}>MXN</span>
                  </div>
                  <select
                    value={unidad}
                    onChange={(e) => setUnidad(e.target.value as Unidad)}
                    style={{ width: 130, height: 34, border: "1px solid var(--line2)", borderRadius: 3, background: "var(--panel)", padding: "0 8px", fontSize: 13 }}
                  >
                    <option value="hora">Por hora</option>
                    <option value="dia">Por día</option>
                  </select>
                </div>
                <div style={{ fontSize: 11, color: "var(--fg3)", marginTop: 6 }}>{rateHint}</div>
              </div>
              <div>
                <label style={labelStyle}>Fecha de ingreso</label>
                <input
                  type="date"
                  value={fechaIngreso}
                  onChange={(e) => setFechaIngreso(e.target.value)}
                  style={{ width: 190, height: 34, border: "1px solid var(--line2)", borderRadius: 3, background: "var(--panel)", padding: "0 10px", fontFamily: "var(--font-mono)", fontSize: 12.5 }}
                />
              </div>
            </div>
          )}

          {paso === 2 && (
            <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
              <div
                style={{
                  width: 96,
                  height: 96,
                  borderRadius: "50%",
                  border: "1px dashed var(--line2)",
                  background: "var(--panel2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  color: "var(--fg3)",
                  textAlign: "center",
                  lineHeight: 1.4,
                  flex: "none",
                }}
              >
                {fotoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- previsualización local de un blob, next/image no aplica aquí.
                  <img src={fotoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <>
                    foto
                    <br />
                    4:5
                  </>
                )}
              </div>
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 500 }}>Foto del empleado</div>
                <div style={{ fontSize: 11.5, color: "var(--fg2)", lineHeight: 1.5, marginTop: 4, maxWidth: 280 }}>
                  Opcional. Sirve para identificarlo en la lista y en la tablet de checado. JPG o PNG, mínimo
                  300×300.
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg"
                    onChange={onFotoChange}
                    style={{ display: "none" }}
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    style={{ border: "1px solid var(--line2)", background: "var(--panel)", borderRadius: 3, height: 28, padding: "0 12px", fontSize: 12, cursor: "pointer" }}
                  >
                    Subir archivo
                  </button>
                  <button
                    onClick={avanzar}
                    style={{ border: 0, background: "transparent", color: "var(--fg2)", height: 28, padding: "0 4px", fontSize: 12, cursor: "pointer", textDecoration: "underline" }}
                  >
                    Omitir
                  </button>
                </div>
              </div>
            </div>
          )}

          {paso === 3 && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", gap: 14, paddingTop: 14 }}>
              {!uid ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
                  <div style={{ position: "relative", width: 74, height: 74, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        border: "1px solid var(--accent)",
                        borderRadius: "50%",
                        animation: "pulsering 1.8s ease-out infinite",
                      }}
                    />
                    <div style={{ width: 44, height: 28, border: "1.5px solid var(--fg2)", borderRadius: 3 }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>Acerca la tarjeta NFC al lector</div>
                    <div style={{ fontSize: 12, color: "var(--fg2)", marginTop: 5 }}>Esperando lectura en la tablet de recepción…</div>
                  </div>
                  {/* TODO: sustituir por lectura real vía Web NFC API (NDEFReader)
                      cuando haya un lector conectado. Ver src/components/personal/nfc.ts */}
                  <button
                    onClick={() => setUid(generarUidSimulado())}
                    style={{ border: "1px solid var(--line2)", background: "transparent", color: "var(--fg2)", borderRadius: 2, height: 26, padding: "0 10px", fontFamily: "var(--font-mono)", fontSize: 10, cursor: "pointer" }}
                  >
                    simular lectura
                  </button>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, animation: "fadein .2s ease" }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: "50%",
                      border: "1px solid var(--ok)",
                      color: "var(--ok)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 18,
                    }}
                  >
                    ✓
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>Tarjeta detectada</div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 15, fontWeight: 600, letterSpacing: "0.06em", marginTop: 8 }}>
                      {uid}
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--fg2)", marginTop: 6 }}>
                      Se vinculará a {nombre.trim() ? shortName(nombre) : "este empleado"} al guardar.
                    </div>
                  </div>
                </div>
              )}
              {error && <div style={{ fontSize: 11.5, color: "var(--neg)" }}>{error}</div>}
            </div>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "14px 20px", borderTop: "1px solid var(--line)", background: "var(--panel2)" }}>
          <button
            onClick={retroceder}
            style={{ border: "1px solid var(--line2)", background: "var(--panel)", borderRadius: 3, height: 30, padding: "0 13px", fontSize: 12.5, cursor: "pointer" }}
          >
            {paso === 0 ? "Cancelar" : "Atrás"}
          </button>
          <button
            onClick={avanzar}
            disabled={nextDisabled}
            style={{
              border: "1px solid var(--accent)",
              background: "var(--accent)",
              color: "var(--panel)",
              borderRadius: 3,
              height: 30,
              padding: "0 15px",
              fontSize: 12.5,
              fontWeight: 500,
              cursor: nextDisabled ? "default" : "pointer",
              opacity: nextDisabled ? 0.6 : 1,
            }}
          >
            {nextLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

const labelStyle: CSSProperties = { display: "block", fontSize: 11.5, fontWeight: 500, color: "var(--fg2)", marginBottom: 6 };
const inputStyle: CSSProperties = { width: "100%", height: 34, border: "1px solid var(--line2)", borderRadius: 3, background: "var(--panel)", padding: "0 10px", fontSize: 13 };
