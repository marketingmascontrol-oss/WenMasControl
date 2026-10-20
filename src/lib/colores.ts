// Deriva un color CSS aproximado a partir de un nombre de color en español
// (texto libre extraído del catálogo, ver scripts/import-productos.ts), para
// mostrar un swatch visual en vez de un botón de texto. Es una aproximación
// por palabra clave, no un mapeo exacto — el nombre real sigue disponible en
// el title/aria-label del botón para quien lo necesite.
const PALABRAS_CLAVE: Array<[RegExp, string]> = [
  [/blanco/i, "#ffffff"],
  [/negro/i, "#18181b"],
  [/gris\s*claro/i, "#d4d4d8"],
  [/gris\s*grafito/i, "#3f3f46"],
  [/gris/i, "#9ca3af"],
  [/azul\s*(marino|oscuro)/i, "#1e3a5f"],
  [/azul\s*rey/i, "#1d4ed8"],
  [/azul\s*cielo/i, "#38bdf8"],
  [/azul\s*ind[ií]go/i, "#4338ca"],
  [/azul/i, "#2563eb"],
  [/rojo/i, "#dc2626"],
  [/amarillo/i, "#eab308"],
  [/verde\s*claro/i, "#86efac"],
  [/verde/i, "#16a34a"],
  [/naranja/i, "#f97316"],
  [/lila|morado|violeta|p[uú]rpura/i, "#a78bfa"],
  [/rosa/i, "#f472b6"],
  [/caf[eé]|marr[oó]n/i, "#78350f"],
  [/caqui|beige|khaki/i, "#c3b091"],
  [/dorado/i, "#ca8a04"],
  [/plateado|plata/i, "#a1a1aa"],
];

// null = no se reconoce ningún color real (ej. "Único", el fallback cuando el
// producto no tiene variantes de color) — quien llama debe mostrar texto en
// vez de un swatch en ese caso.
export function colorCss(nombre: string): string | null {
  for (const [patron, css] of PALABRAS_CLAVE) {
    if (patron.test(nombre)) return css;
  }
  return null;
}
