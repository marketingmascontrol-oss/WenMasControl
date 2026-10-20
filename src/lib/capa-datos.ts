// Capa de datos para Meta y LinkedIn — NO para Google Ads.
//
// 🔴 LA LÍNEA QUE NO SE CRUZA. Las conversiones de Google Ads las reporta
// medicion.ts con gtag directo, y ese archivo ya advierte por qué: si además se
// arman en GTM, Ads cuenta la misma conversión dos veces y «Maximizar valor»
// empieza a pujar por el término equivocado. Una conversión duplicada no falla
// de forma visible — se ve como una campaña que mejoró.
//
// Por eso GTM NO debe llevar ninguna etiqueta de conversión de Google Ads.
// (Verificado el 25/08/2026: el contenedor de GTM de Wincol (origen de este código) no tiene ningún ID
// AW-, y así tiene que seguir.)
//
// Lo que sí va en GTM es el píxel de Meta y el Insight Tag de LinkedIn, y para
// eso necesitan estos eventos. Sin ellos, GTM tendría que adivinar leyendo el
// DOM a punta de selectores CSS, que se rompen con cualquier cambio de diseño.
//
// El SKU es el dato crítico: es el mismo `id` que llevan los feeds
// (src/lib/feed.ts). Si el píxel manda otra cosa como content_ids, Meta no
// puede emparejar la vista con el producto del catálogo y las campañas de
// Advantage+ dejan de reimpactar con la foto correcta.

export interface ItemCapaDatos {
  /** SKU. Tiene que coincidir exacto con `g:id` del feed. */
  item_id: string;
  item_name?: string;
  price?: number;
  quantity?: number;
  item_category?: string;
  item_variant?: string;
}

interface DatosEvento {
  value?: number;
  items?: ItemCapaDatos[];
  origen?: string;
  [clave: string]: unknown;
}

// La declaración global de `Window.dataLayer` vive en medicion.ts, que es
// quien la crea primero al cargar gtag. Declararla otra vez acá con distinto
// tipo rompe la compilación.

/**
 * Empuja un evento a dataLayer para que GTM lo escuche.
 *
 * Nunca lanza: un fallo de medición jamás puede impedir que el cliente compre.
 * Si GTM no cargó (bloqueador, red caída), el array existe igual y los eventos
 * quedan encolados para cuando cargue.
 */
export function empujar(evento: string, datos: DatosEvento = {}): void {
  if (typeof window === "undefined") return;
  try {
    window.dataLayer = window.dataLayer ?? [];
    window.dataLayer.push({ event: evento, currency: "COP", ...datos });
  } catch {
    /* sin telemetría de la telemetría */
  }
}

// Nombres estables: son el contrato con GTM. Cambiar uno acá apaga la etiqueta
// del otro lado sin ningún error visible.
export const EVENTOS = {
  verProducto: "mc_ver_producto",      // -> Meta ViewContent
  agregarCarrito: "mc_agregar_carrito", // -> Meta AddToCart
  iniciarCheckout: "mc_iniciar_checkout", // -> Meta InitiateCheckout
  whatsapp: "mc_whatsapp",             // -> Meta Lead + LinkedIn conversión
} as const;
