// Medición de conversiones de Google Ads — el clic a WhatsApp.
//
// 🔴 POR QUÉ EXISTE, 13/08/2026. Si hay campaña corriendo y Google
// no tiene forma de saber qué clic terminó en una conversación: puja a ciegas.
// Cada clic en «Pagar por WhatsApp» tiene que llegar a Ads como una conversión
// para que la campaña optimice hacia la venta y no hacia el tráfico barato.
//
// ⚠️ EL CLIC NO ES UNA VENTA. Es el indicador más cercano que se puede medir
// desde el sitio: la conversación sigue en WhatsApp, fuera de este dominio. El
// costo por venta real se calcula aparte, del lado de Arkco360.
//
// ## Por qué no alcanza un disparador por URL
//
// La guía de Google propone un `onclick` en el enlace, y GTM propone un
// disparador «Click URL contiene wa.me». Ninguno de los dos alcanza acá: el
// botón principal —el del carrito, el que de verdad importa— **no es un
// enlace**, es `window.open(...)` desde JavaScript. Un disparador por enlace
// mediría los botones secundarios y se perdería justo la conversión de la
// compra.
//
// Por eso hay dos caminos, y los dos llaman a la misma función:
//   1. `reportarClicWhatsApp()` a mano, donde el código abre WhatsApp por JS
//   2. un oyente delegado en el layout para cualquier `<a href*="wa.me">`

import { EVENTOS as EVENTOS_CAPA, empujar } from "./capa-datos";
import { debeMedir } from "./dominio";
import { iniciarCheckout as checkoutMeta } from "./meta";
import { SITE } from "./site";

// Cuenta de Google Ads de +Control. Vienen de site.ts; vacías = no se reporta.
export const GOOGLE_ADS_ID = SITE.medicion.googleAds ?? "";
export const CONVERSION_CLIC_WHATSAPP = SITE.medicion.conversionWhatsApp ?? "";

// Las otras dos acciones de conversión.
//
// 🚫 NO armarlas también en GTM: la etiqueta directa ya las reporta y GTM las
// contaría por segunda vez. Una conversión duplicada no falla de forma visible
// —se ve como una campaña que mejoró— y «Maximizar valor» empieza a pujar por
// el término equivocado.
export const CONVERSION_AGREGO_AL_CARRITO = SITE.medicion.conversionCarrito ?? "";
export const CONVERSION_COMPRA = SITE.medicion.conversionCompra ?? "";


// La guarda de dominio vive en dominio.ts: la comparten Google Ads y Meta.
export { debeMedir } from "./dominio";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

/**
 * Avisa a Google Ads que alguien se fue a WhatsApp.
 *
 * No corta la navegación ni la retrasa: todos los botones de este sitio abren
 * WhatsApp en una pestaña nueva, así que esta pestaña sigue viva y el evento
 * sale sin necesidad del `event_callback` que recomienda Google para el caso
 * de navegación en la misma pestaña.
 *
 * Nunca lanza: un bloqueador de anuncios deja `gtag` sin definir, y que no se
 * pueda medir jamás puede impedir que el cliente escriba.
 */
export function reportarClicWhatsApp(origen: string): void {
  reportar(CONVERSION_CLIC_WHATSAPP, { event_label: origen });
}

/**
 * El disparo, en un solo lugar.
 *
 * Sin etiqueta no hace nada: ver el comentario de las constantes. Nunca lanza:
 * un bloqueador de anuncios deja `gtag` sin definir, y que no se pueda medir
 * jamás puede impedir que el cliente compre.
 */
function reportar(etiqueta: string, datos: Record<string, unknown>): void {
  try {
    if (!etiqueta) return;
    if (!debeMedir() || typeof window.gtag !== "function") return;
    window.gtag("event", "conversion", { send_to: etiqueta, ...datos });
  } catch {
    /* medir nunca puede romper la compra */
  }
}


// ── Atribución hasta la venta ────────────────────────────────────────────────

/**
 * 🔴 LO QUE FALTABA. Arriba está dicho: «el clic no es una venta», y el costo
 * por venta real se calculaba aparte, del lado de Arkco360. Eso significa que
 * Ads optimiza contra una señal intermedia — pedidos enviados — y nunca sabe
 * cuáles se cobraron. Con ticket B2B alto, esa diferencia es la que decide si
 * «Maximizar valor» puja por el mayorista o por el que compra un par de guantes.
 *
 * Esto guarda la intención junto con el gclid/fbclid de la visita (cookie que
 * pone el middleware) y el código MC-XXXX que viaja dentro del mensaje de
 * WhatsApp, para poder ver cuántos clics a WhatsApp genera cada campaña.
 *
 * La venta y su monto NO se anotan acá: eso vive en Arkco360, junto al lead y
 * la conversación. Ver la sección «LA FRONTERA» de CLAUDE.md.
 *
 * Usa `sendBeacon` a propósito: sobrevive a que la pestaña se vaya a WhatsApp y
 * —clave— NO bloquea el `window.open`. Un `await fetch()` antes de abrir rompe
 * la apertura en móvil, porque el navegador deja de considerarla consecuencia
 * directa del toque.
 */
export function registrarIntencion(payload: Record<string, unknown>): void {
  try {
    // Mismo criterio que el resto del archivo: sólo dominios de producción.
    // Sin esto, cada `npm run dev` llenaría el panel del cliente de
    // conversaciones que nunca existieron.
    if (!debeMedir() || typeof navigator === "undefined") return;

    const cuerpo = new Blob([JSON.stringify(payload)], { type: "application/json" });
    if (navigator.sendBeacon?.("/api/atribucion", cuerpo)) return;

    // Safari viejo y navegadores embebidos (el de Instagram, el de Facebook)
    // no traen sendBeacon.
    void fetch("/api/atribucion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* medir nunca puede romper la compra */
  }
}

// ── Compra ───────────────────────────────────────────────────────────────────

export interface LineaMedida {
  sku: string;
  precio: number;
  cantidad: number;
}

/**
 * 🔴 POR QUÉ HAY QUE DES-DUPLICAR, y por qué importa más de lo que parece.
 *
 * +Control no cierra la venta en el sitio: el pedido se va a WhatsApp. O sea que
 * el botón «Pagar por WhatsApp» se puede pulsar dos, tres veces —se cerró la
 * pestaña, no cargó, el cliente volvió atrás— y el carrito sigue igual.
 *
 * Sin candado, ese mismo pedido entraría a Ads como tres compras con su valor
 * completo. Y como la conversión de Compra SÍ manda valor real, «Maximizar
 * valor» empezaría a pujar más fuerte por el término que más se re-pulsa, no
 * por el que más vende. Los datos malos no se notan: se ven como una campaña
 * que mejoró.
 *
 * El candado es el contenido del carrito, no un contador: si el cliente agrega
 * otro producto y vuelve a mandar, eso SÍ es un pedido distinto y sí reporta.
 * Vive en `sessionStorage` —muere al cerrar la pestaña— porque un cliente que
 * vuelve mañana con el mismo carrito sí es una venta nueva.
 */
function yaSeReporto(clave: string): boolean {
  try {
    const k = `mc:compra:${clave}`;
    if (sessionStorage.getItem(k)) return true;
    sessionStorage.setItem(k, "1");
    return false;
  } catch {
    // Modo incógnito con storage bloqueado: se prefiere medir de más a no
    // medir. Una conversión repetida se puede depurar; una que nunca llegó, no.
    return false;
  }
}

function huellaDelCarrito(lineas: LineaMedida[]): string {
  return lineas
    .map((l) => `${l.sku}x${l.cantidad}`)
    .sort()
    .join("|");
}

/**
 * El pedido que se fue a WhatsApp, con su valor real.
 *
 * ⚠️ Esto NO es una venta cobrada: es un pedido enviado. La conversación sigue
 * en WhatsApp y ahí puede caerse. Es lo más cerca de la venta que este sitio
 * puede ver, y manda el valor de verdad del carrito en vez de una cifra
 * inventada — que es lo que le permite a Ads aprender solo cuánto vale en
 * promedio un pedido.
 */
export function reportarCompra(lineas: LineaMedida[], origen: string): void {
  try {
    if (!lineas?.length) return;
    const valor = lineas.reduce(
      (s, l) => s + (Number(l.precio) || 0) * (Number(l.cantidad) || 1),
      0
    );
    if (valor <= 0) return;

    const huella = huellaDelCarrito(lineas);
    if (yaSeReporto(huella)) return;

    reportar(CONVERSION_COMPRA, {
      value: valor,
      currency: "COP",
      // Ads también des-duplica del lado suyo si le llega el mismo id.
      transaction_id: `mc-${huella}`,
      event_label: origen,
    });

    checkoutMeta(lineas.map((l) => ({ sku: l.sku, precio: l.precio, cantidad: l.cantidad })));

    // LinkedIn y GA4, vía GTM. Ads ya se reportó arriba con gtag directo, y
    // GTM NO debe llevar etiqueta de Ads: contaría la compra dos veces.
    empujar(EVENTOS_CAPA.iniciarCheckout, {
      value: valor,
      items: lineas.map((l) => ({ item_id: l.sku, price: l.precio, quantity: l.cantidad })),
    });

    // Y el rastro para la conversión sin conexión. Va acá y NO en
    // reportarClicWhatsApp porque el carrito llama a las dos: puesto allá, cada
    // pedido dejaría dos filas y el costo por venta saldría a la mitad.
    // Comparte el candado de des-duplicación de arriba.
    registrarIntencion({
      evento: "whatsapp_pedido",
      origen,
      valor_estimado: valor,
      items: lineas.map((l) => ({
        item_id: l.sku,
        price: l.precio,
        quantity: l.cantidad,
      })),
    });
  } catch {
    /* medir nunca puede romper la compra */
  }
}

/**
 * Alguien puso algo en el carrito. Señal temprana: dice qué anuncios traen
 * gente con intención de compra, incluso cuando no llegan a mandar el pedido.
 *
 * No se des-duplica: agregar dos veces son dos señales de interés reales.
 */
export function reportarAgregadoAlCarrito(linea: LineaMedida, origen: string): void {
  try {
    const valor = (Number(linea?.precio) || 0) * (Number(linea?.cantidad) || 1);
    reportar(CONVERSION_AGREGO_AL_CARRITO, {
      value: valor,
      currency: "COP",
      event_label: origen,
    });
  } catch {
    /* medir nunca puede romper la compra */
  }
}
