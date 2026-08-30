"use client";

import { useActionState, type CSSProperties } from "react";
import { iniciarSesion, type EstadoLogin } from "./actions";

const estadoInicial: EstadoLogin = {};

export default function LoginPage() {
  const [estado, accion, pendiente] = useActionState(
    iniciarSesion,
    estadoInicial
  );

  return (
    <div style={estilos.fondo}>
      <div style={estilos.tarjeta}>
        <h1 style={estilos.titulo}>Nómina</h1>
        <p style={estilos.subtitulo}>Acceso restringido</p>

        <form action={accion} style={estilos.formulario}>
          <label htmlFor="password" style={estilos.label}>
            Contraseña
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoFocus
            required
            autoComplete="current-password"
            style={estilos.input}
          />

          {estado.error ? (
            <p style={estilos.error} role="alert">
              {estado.error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={pendiente}
            style={{
              ...estilos.boton,
              opacity: pendiente ? 0.6 : 1,
              cursor: pendiente ? "default" : "pointer",
            }}
          >
            {pendiente ? "Entrando…" : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}

const estilos: Record<string, CSSProperties> = {
  fondo: {
    minHeight: "100dvh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "var(--bg)",
    padding: 16,
  },
  tarjeta: {
    width: "100%",
    maxWidth: 320,
    background: "var(--panel)",
    border: "1px solid var(--line2)",
    borderRadius: 4,
    boxShadow: "var(--shadow)",
    padding: "28px 24px",
  },
  titulo: {
    margin: 0,
    fontSize: 19,
    fontWeight: 600,
    color: "var(--fg)",
  },
  subtitulo: {
    margin: "4px 0 20px",
    fontSize: 11.5,
    color: "var(--fg2)",
  },
  formulario: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  label: {
    fontFamily: "var(--font-mono), 'IBM Plex Mono', monospace",
    fontSize: 9.5,
    letterSpacing: "0.11em",
    textTransform: "uppercase",
    color: "var(--fg3)",
  },
  input: {
    height: 34,
    borderRadius: 3,
    border: "1px solid var(--line2)",
    background: "var(--panel)",
    color: "var(--fg)",
    fontSize: 13,
    padding: "0 10px",
    outline: "none",
  },
  error: {
    margin: "2px 0 0",
    fontSize: 10.5,
    color: "var(--neg)",
  },
  boton: {
    marginTop: 14,
    height: 34,
    borderRadius: 3,
    border: "none",
    background: "var(--accent)",
    color: "var(--panel)",
    fontSize: 12.5,
    fontWeight: 500,
  },
};
