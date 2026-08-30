/**
 * Helper cliente para el tema claro/oscuro.
 *
 * Compatible con el script anti-flash inline en `src/app/layout.tsx`:
 * ambos leen y escriben la misma clave de localStorage ("theme") y el
 * mismo atributo (`document.documentElement.dataset.theme`), con los
 * mismos valores ("light" | "dark").
 *
 * Si no hay preferencia guardada, no se fija ningún atributo y el CSS
 * decide el tema según `prefers-color-scheme` (ver globals.css).
 */

export type Theme = "light" | "dark";

const STORAGE_KEY = "theme";

/**
 * Tema actualmente aplicado al documento. Si el usuario nunca eligió uno
 * explícitamente, se infiere a partir de la preferencia del sistema.
 */
export function getTheme(): Theme {
  if (typeof document === "undefined") return "light";

  const attr = document.documentElement.dataset.theme;
  if (attr === "dark" || attr === "light") return attr;

  if (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-color-scheme: dark)").matches
  ) {
    return "dark";
  }

  return "light";
}

/** Tema explícitamente guardado por el usuario, si existe. */
export function getStoredTheme(): Theme | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === "dark" || stored === "light" ? stored : null;
  } catch {
    return null;
  }
}

/** Aplica y persiste un tema explícito. */
export function setTheme(theme: Theme): void {
  if (typeof document !== "undefined") {
    document.documentElement.dataset.theme = theme;
  }
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // localStorage puede no estar disponible (modo privado, etc.)
    }
  }
}

/** Alterna entre claro y oscuro a partir del tema actual, y lo persiste. */
export function toggleTheme(): Theme {
  const next: Theme = getTheme() === "dark" ? "light" : "dark";
  setTheme(next);
  return next;
}
