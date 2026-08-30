# Sistema de diseño — Nómina

Referencia rápida para construir componentes. Fuente de verdad: el
prototipo `Personal Nómina.dc.html` (Claude Design). Tokens y reset en
`src/app/globals.css`, fuentes en `src/app/layout.tsx`, helpers en
`src/lib/theme.ts` y `src/lib/format.ts`.

## Tokens (`:root`, override en `:root[data-theme="dark"]` y `prefers-color-scheme: dark`)

| Token | Uso |
|---|---|
| `--bg` | Fondo general de la página |
| `--panel` | Fondo de tarjetas, header, footer, modales |
| `--panel2` | Fondo secundario (avatares, filas alternas, zebra sutil) |
| `--fg` | Texto principal |
| `--fg2` | Texto secundario (roles, metadatos, subtítulos) |
| `--fg3` | Texto terciario (labels de sección, placeholders, timestamps) |
| `--line` | Bordes/divisores sutiles (filas de tabla) |
| `--line2` | Bordes más marcados (inputs, tarjetas, controles) |
| `--accent` | Acciones primarias, foco, enlaces |
| `--accent-soft` | Fondo suave para estados de foco/selección con `--accent` |
| `--warn` | Advertencias (sin tarjeta NFC, alertas de cierre) |
| `--warn-soft` | Fondo suave de advertencia |
| `--ok` | Confirmaciones ("guardado", tarjeta detectada) |
| `--neg` | Errores, zona de riesgo, dar de baja |
| `--shadow` | Sombra de paneles flotantes (drawer, modal, menú) |

Todos los valores son `oklch(...)` copiados literalmente del prototipo — no
reinterpretar. `@media print` los reemplaza por escala de grises/blanco y
negro puro, y oculta todo lo marcado `[data-noprint]`.

## Tipografía

Sans (IBM Plex Sans) para texto de lectura; Mono (IBM Plex Mono) para
**todo dato numérico o de sistema**: montos, horas, UIDs de tarjeta,
labels de sección, timestamps, badges de estado.

Escala real usada en el prototipo (no inventar tamaños intermedios):

| Tamaño | Dónde se usa |
|---|---|
| 9px | labels de columna de tablas (`<th>`) |
| 9.5px | labels de sección (mono, uppercase, tracking .11em, `--fg3`) — clase `.section-label` |
| 10px | badges de estado, texto de botones ghost pequeños |
| 10.5px | hints de ayuda bajo inputs, texto de leyenda de asistencia |
| 11px | UID de tarjeta, subtítulos de fila |
| 11.5px | texto de fila secundario, botones de 28px |
| 12px | ítems de menú contextual, texto de barra de filtros |
| 12.5px | texto de botón estándar, inputs de búsqueda |
| 13px | texto de fila principal (nombre), inputs de formulario |
| 13.5px | monto editable inline en tabla |
| 14px | inputs destacados (monto en wizard) |
| 14.5px | títulos de modal |
| 15px | mensajes de estado vacío |
| 16px | tabs activos del header, nombre en panel lateral |
| 19px | cifras secundarias del resumen de cierre (sueldos, bonos, descuentos) |
| 28px | monto grande en panel lateral de empleado |
| 30px | cifra hero ("Total a pagar") |

## Medidas de layout

- Altura de fila de tabla: **44px**
- Alturas de control: **34px** (inputs de formulario/wizard), **30px** (botones/inputs de header), **28px** (botones secundarios), **26px** (botones icon-only, filas de resumen de cierre)
- Radios de borde: **2px** (badges, botones pequeños), **3px** (inputs, botones estándar, tarjetas), **4px** (modal del wizard)

## Convención de fuente por tipo de dato

- **IBM Plex Mono**: dinero, horas/fechas, UIDs NFC, labels de sección, badges, contadores.
- **IBM Plex Sans**: nombres, roles, descripciones, mensajes al usuario.

Body corre a `font-size: 13px` (ver `layout.tsx`) — todos los tamaños de
la tabla anterior son absolutos en px, no relativos a ese base.
