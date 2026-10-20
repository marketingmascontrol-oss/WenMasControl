// Atribución de campañas pagas -> conversación de WhatsApp.
//
// El problema que resuelve: el cierre de venta NO ocurre en el sitio, ocurre en
// WhatsApp (lo atiende Arkco360). En el momento en que el usuario toca "Hablar
// con un asesor" se va del dominio y, sin esto, Google/Meta/LinkedIn nunca se
// enteran de si esa conversación terminó en venta ni de cuánto facturó.
//
// La solución es un código corto (MC-7K2M) que viaja DENTRO del mensaje de
// WhatsApp. El asesor lo ve en el chat; cuando la venta se cierra se registra
// contra ese código, y de ahí sale el gclid/fbclid original para subir la
// conversión sin conexión con su valor real en pesos. Recién ahí Google deja de
// optimizar a "clics baratos" y empieza a optimizar a compradores mayoristas.
//
// Este módulo sólo importa constantes (site.ts): corre igual en el middleware
// (servidor) y en los scripts del navegador. Cualquier dependencia de Supabase
// o de `document` acá rompería uno de los dos lados.

import { SITE } from "./site";

export const COOKIE_ATRIBUCION = "mc_attr";
export const COOKIE_REF = "mc_ref";

// 90 días: el ciclo de decisión B2B en dotación pasa largo de los 30 días
// típicos de e-commerce (cotización -> aprobación de compras -> orden).
export const DIAS_ATRIBUCION = 90;

// Identificadores de clic de cada plataforma. gbraid/wbraid son los que manda
// Google cuando el usuario viene de iOS sin gclid disponible: si no se capturan,
// se pierde silenciosamente buena parte del tráfico de móvil.
export const PARAMS_CLIC = [
  "gclid",
  "gbraid",
  "wbraid",
  "fbclid",
  "li_fat_id",
  "ttclid",
  "msclkid",
] as const;

export const PARAMS_UTM = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
] as const;

export interface Atribucion {
  /** Identificadores de clic (gclid, fbclid, …) y UTM, tal como llegaron. */
  params: Record<string, string>;
  /** Primera página de aterrizaje de esta atribución. */
  landing?: string;
  /** Referente externo, útil para separar orgánico de directo. */
  referrer?: string;
  /** ISO de cuándo se capturó. */
  ts: string;
}

// Alfabeto sin caracteres ambiguos: el asesor lee este código en un chat y lo
// transcribe a mano. O/0 e I/1/L se confunden y arruinan el emparejamiento.
const ALFABETO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/**
 * Letra de origen dentro del código. Va ahí para que el asesor sepa de dónde
 * viene la persona SIN abrir el panel: leer «MC-G-7K2M» en el chat ya dice que
 * llegó por Google. El dato autoritativo sigue siendo la fila de atribución
 * —ahí están el gclid y los UTM completos—, esto es la pista rápida.
 *
 * D = directo u orgánico. Nunca se deja sin letra: un código sin origen es
 * indistinguible de un código roto.
 */
export type FuenteCodigo = "G" | "M" | "L" | "T" | "B" | "D";

const PATRONES_FUENTE: Array<[FuenteCodigo, RegExp]> = [
  ["G", /^(google|adwords|google_ads|googleads)$/i],
  ["M", /^(facebook|instagram|meta|fb|ig)$/i],
  ["L", /^linkedin$/i],
  ["T", /^tiktok$/i],
  ["B", /^(bing|microsoft)$/i],
];

/** Deduce el origen a partir de los identificadores de clic y los UTM. */
export function fuenteDeParams(params: Record<string, string> | undefined): FuenteCodigo {
  if (!params) return "D";

  // Los identificadores de clic mandan sobre el UTM: son los que pone la
  // plataforma y no se pueden escribir mal a mano en un enlace.
  if (params.gclid || params.gbraid || params.wbraid) return "G";
  if (params.fbclid) return "M";
  if (params.li_fat_id) return "L";
  if (params.ttclid) return "T";
  if (params.msclkid) return "B";

  const fuente = (params.utm_source ?? "").trim();
  for (const [letra, patron] of PATRONES_FUENTE) {
    if (patron.test(fuente)) return letra;
  }

  return "D";
}

/** Sufijo aleatorio de 4 caracteres. */
function sufijo(aleatorio: () => number = Math.random): string {
  let cuerpo = "";
  for (let i = 0; i < 4; i++) {
    cuerpo += ALFABETO[Math.floor(aleatorio() * ALFABETO.length)];
  }
  return cuerpo;
}

/** Genera un código completo, tipo `MC-G-7K2M`. */
export function generarCodigoRef(fuente: FuenteCodigo, aleatorio?: () => number): string {
  return `${SITE.prefijoRef}-${fuente}-${sufijo(aleatorio)}`;
}

/** Genera un código usando la fuente de entropía criptográfica disponible. */
export function generarCodigoRefSeguro(fuente: FuenteCodigo): string {
  const cripto = globalThis.crypto;
  if (!cripto?.getRandomValues) return generarCodigoRef(fuente);

  const bytes = new Uint8Array(4);
  cripto.getRandomValues(bytes);
  let i = 0;
  return generarCodigoRef(fuente, () => bytes[i++] / 256);
}

/**
 * Cambia la letra de origen conservando el sufijo.
 *
 * Pasa de verdad: alguien entra por Google, se va, y vuelve una semana después
 * por un anuncio de Meta. La atribución de pago es de última interacción, así
 * que la letra tiene que seguirla — pero el sufijo NO cambia, porque es lo que
 * une todas las visitas de esa misma persona.
 */
export function conFuente(codigo: string, fuente: FuenteCodigo): string {
  const partes = codigo.split("-");
  const cola = partes[partes.length - 1];
  // Un código con formato inesperado (una cookie vieja) se regenera entero en
  // vez de producir algo tipo "MC-G-MC".
  if (partes.length < 2 || !cola || cola.length !== 4) return generarCodigoRefSeguro(fuente);
  return `${SITE.prefijoRef}-${fuente}-${cola}`;
}

/**
 * Extrae los parámetros de campaña de una URL. Devuelve `null` si no hay
 * ninguno, para no pisar una atribución previa con una visita orgánica.
 */
export function extraerParamsCampana(url: URL): Record<string, string> | null {
  const params: Record<string, string> = {};

  for (const clave of [...PARAMS_CLIC, ...PARAMS_UTM]) {
    const valor = url.searchParams.get(clave);
    // Se recorta a 512 para que una URL manipulada no infle la cookie hasta
    // hacerla ilegible (los navegadores tumban cookies de más de ~4 KB).
    if (valor) params[clave] = valor.slice(0, 512);
  }

  return Object.keys(params).length > 0 ? params : null;
}

/** ¿Esta visita trae algún identificador de clic pago? */
export function tieneClicPago(params: Record<string, string>): boolean {
  return PARAMS_CLIC.some((clave) => Boolean(params[clave]));
}

export function serializarAtribucion(atribucion: Atribucion): string {
  return encodeURIComponent(JSON.stringify(atribucion));
}

export function deserializarAtribucion(crudo: string | undefined): Atribucion | null {
  if (!crudo) return null;
  try {
    const dato = JSON.parse(decodeURIComponent(crudo));
    if (!dato || typeof dato !== "object" || typeof dato.params !== "object") return null;
    return dato as Atribucion;
  } catch {
    // Cookie corrupta o de un formato viejo: se descarta sin romper la página.
    return null;
  }
}

/**
 * Lee una cookie desde el navegador. Devuelve `undefined` en servidor, así que
 * los módulos que se ejecutan en ambos lados pueden llamarla sin guardas.
 */
export function leerCookieCliente(nombre: string): string | undefined {
  if (typeof document === "undefined") return undefined;

  const prefijo = `${nombre}=`;
  for (const parte of document.cookie.split("; ")) {
    if (parte.startsWith(prefijo)) return parte.slice(prefijo.length);
  }
  return undefined;
}

/** Código de referencia vigente para esta visita, o `null` si no hay cookie. */
export function leerCodigoRefCliente(): string | null {
  return leerCookieCliente(COOKIE_REF) ?? null;
}
