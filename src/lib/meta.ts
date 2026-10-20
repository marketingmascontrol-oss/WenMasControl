// Píxel de Meta (Facebook e Instagram).
//
// 🔴 POR QUÉ VA EN CÓDIGO Y NO EN GTM. El plan original era montarlo en Google
// Tag Manager, pero acá el código ya tiene el dato exacto que Meta necesita: el
// SKU. Configurarlo en GTM obligaría a leerlo del DOM con selectores CSS que se
// rompen con cualquier cambio de diseño, y el `content_ids` es justamente el
// campo que no puede fallar (ver abajo).
//
// ⚠️ ENTONCES NO LO PONGAN TAMBIÉN EN GTM. Si el píxel se carga dos veces, cada
// evento se cuenta doble: Meta reporta el doble de conversiones al mismo costo,
// el ROAS se ve inflado y las campañas se escalan contra un número inventado.
// No falla de forma visible — se ve como una campaña que mejoró.
//
// El contenedor de GTM (SITE.medicion.gtm) queda para LinkedIn y GA4.

import { debeMedir } from "./dominio";
import { SITE } from "./site";

// Conjunto de datos de +Control, desde site.ts. Vacío = píxel apagado.
// No es un secreto: viaja en el HTML público de todas formas, igual que el ID
// de Google Ads en medicion.ts.
export const META_PIXEL_ID = SITE.medicion.metaPixel ?? "";

/** Producto para los eventos de catálogo. */
export interface ItemMeta {
  sku: string;
  precio?: number;
  cantidad?: number;
}

declare global {
  interface Window {
    fbq?: ((...args: unknown[]) => void) & { callMethod?: unknown; queue?: unknown[] };
    _fbq?: unknown;
  }
}

/**
 * Manda un evento estándar de Meta.
 *
 * Nunca lanza: un bloqueador de anuncios deja `fbq` sin definir, y que no se
 * pueda medir jamás puede impedir que el cliente escriba.
 */
function reportar(evento: string, datos: Record<string, unknown> = {}): void {
  try {
    if (!META_PIXEL_ID || !debeMedir() || typeof window.fbq !== "function") return;
    window.fbq("track", evento, { currency: "COP", ...datos });
  } catch {
    /* medir nunca puede romper la compra */
  }
}

/**
 * 🔴 EL CAMPO QUE NO PUEDE FALLAR. `content_ids` tiene que ser el SKU, que es
 * exactamente el mismo valor que lleva `g:id` en los feeds (src/lib/feed.ts).
 *
 * Si el píxel mandara el identificador interno de la base de datos, Meta no
 * podría emparejar lo que la persona vio con el producto del catálogo, y las
 * campañas de Advantage+ dejarían de reimpactar con la foto correcta. El
 * síntoma sería una campaña de catálogo que gasta y no vende, sin ningún error
 * a la vista.
 */
function contenido(items: ItemMeta[]) {
  return {
    content_type: "product",
    content_ids: items.map((i) => i.sku),
    contents: items.map((i) => ({
      id: i.sku,
      quantity: i.cantidad ?? 1,
      item_price: i.precio,
    })),
  };
}

function valorDe(items: ItemMeta[]): number {
  return items.reduce((s, i) => s + (Number(i.precio) || 0) * (Number(i.cantidad) || 1), 0);
}

/** Alguien abrió una ficha de producto. */
export function verProducto(item: ItemMeta): void {
  reportar("ViewContent", { ...contenido([item]), value: item.precio ?? 0 });
}

/** Alguien puso algo en el carrito. */
export function agregarAlCarrito(item: ItemMeta): void {
  reportar("AddToCart", { ...contenido([item]), value: valorDe([item]) });
}

/** Alguien mandó el pedido del carrito por WhatsApp. */
export function iniciarCheckout(items: ItemMeta[]): void {
  if (!items.length) return;
  reportar("InitiateCheckout", {
    ...contenido(items),
    value: valorDe(items),
    num_items: items.reduce((s, i) => s + (Number(i.cantidad) || 1), 0),
  });
}

/**
 * Alguien tocó un botón de WhatsApp.
 *
 * Se manda como `Lead` y no como `Contact` a propósito: `Lead` es un evento
 * estándar que sirve como objetivo de optimización en las campañas, y es la
 * acción que de verdad genera negocio en este sitio.
 */
export function lead(origen: string): void {
  reportar("Lead", { content_name: origen });
}
