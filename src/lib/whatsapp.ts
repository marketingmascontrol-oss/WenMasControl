import type { ItemCarrito } from "../stores/carrito";
import { formatearPrecio } from "./formato";
import { SITE } from "./site";
import { leerCodigoRefCliente } from "./atribucion";

/**
 * Anexa el código de referencia de la visita al final del mensaje.
 *
 * 🔴 POR QUÉ. medicion.ts ya avisa a Ads que alguien se fue a WhatsApp, pero
 * ahí se corta: el clic no es una venta y la conversación sigue afuera del
 * dominio. Este código —MC-G-7K2M, al final del mensaje— es la llave: el asesor
 * lo ve en el chat y con él cruza la conversación con la campaña que la trajo.
 * La letra dice el origen (G Google, M Meta, L LinkedIn, D directo).
 *
 * La venta y su monto NO se anotan acá. Viven en Arkco360, junto al lead y la
 * conversación; el gclid ya llega allá dentro de leads.niche_data.referral_ad.
 * Este proyecto genera el código y lo mete en el mensaje: nada más. Ver la
 * sección «LA FRONTERA» de CLAUDE.md.
 *
 * Recién con eso «Maximizar valor» puja por lo que factura y no por lo que
 * genera clics baratos.
 *
 * Si no hay cookie (render en servidor, navegador que la bloquea), el mensaje
 * sale igual sin la línea: medir nunca puede impedir que el cliente escriba.
 */
function conCodigoRef(mensaje: string, codigo?: string | null): string {
  // En el servidor no hay cookies del navegador: el llamador pasa el código
  // desde Astro.cookies. En el cliente se lee solo. Sin esto, los enlaces que
  // Astro pinta en el servidor —el botón flotante y la ficha de producto—
  // saldrían sin código y se perdería la mitad del tráfico medido.
  const ref = codigo ?? leerCodigoRefCliente();
  return ref ? `${mensaje}\n\nRef: ${ref}` : mensaje;
}

function enlace(mensaje: string, codigo?: string | null): string {
  // SITE.whatsapp, no SITE.telefonoTel: el primero es el número que RECIBE LOS
  // LEADS; el segundo es la línea para llamar. Confundirlos manda los pedidos
  // del carrito a un WhatsApp que no los espera.
  //
  // ⚠️ Cuál es hoy se decide en `site.ts` y NO es el de Arkco: desde el
  // 01/09/2026 los leads del sitio van a la asesora humana, por decisión del
  // dueño. Volver a Arkco es un renglón allá, no un cambio acá.
  return `https://wa.me/${SITE.whatsapp}?text=${encodeURIComponent(conCodigoRef(mensaje, codigo))}`;
}

// Arma el link de WhatsApp con el detalle completo del pedido (producto, SKU,
// cantidad, precio y total) para que Arkco360 pueda atender la conversación
// con toda la información ya sobre la mesa, sin pasarela de pago propia.
/** Datos opcionales de quien pide, para que el asesor cotice sin preguntarlos. */
export interface DatosEmpresa {
  empresa?: string;
  nit?: string;
  ciudad?: string;
}

export function construirEnlaceWhatsAppPedido(
  carrito: readonly ItemCarrito[],
  codigo?: string | null,
  datos?: DatosEmpresa,
): string {
  const lineas = carrito.map((item) => {
    const subtotal = item.precio * item.cantidad;
    return `• ${item.cantidad}x ${item.nombre} (SKU: ${item.sku}, Talla: ${item.talla}, Color: ${item.color}) — ${formatearPrecio(item.precio)} c/u = ${formatearPrecio(subtotal)}`;
  });

  const total = carrito.reduce((acc, i) => acc + i.precio * i.cantidad, 0);

  return enlace([
    "¡Hola! Quiero hacer este pedido:",
    "",
    ...lineas,
    "",
    `Total: ${formatearPrecio(total)}`,
    ...lineasEmpresa(datos),
    "",
    "Quedo atento para coordinar el pago y el envío.",
  ].join("\n"), codigo);
}

// Las líneas de empresa van después del total y sólo las que se llenaron: un
// pedido sin datos sale idéntico al de antes.
function lineasEmpresa(datos?: DatosEmpresa): string[] {
  const lineas = [
    datos?.empresa?.trim() && `Empresa: ${datos.empresa.trim()}`,
    datos?.nit?.trim() && `NIT: ${datos.nit.trim()}`,
    datos?.ciudad?.trim() && `Entrega en: ${datos.ciudad.trim()}`,
  ].filter((l): l is string => Boolean(l));
  return lineas.length ? ["", ...lineas] : [];
}

// Enlace de WhatsApp con un mensaje simple ya redactado, para consultas de
// disponibilidad ("bajo solicitud") o pedidos de cantidad mayor al stock.
export function construirEnlaceWhatsAppConsulta(mensaje: string, codigo?: string | null): string {
  return enlace(mensaje, codigo);
}

/**
 * Atajo al asesor sin pasar por el carrito.
 *
 * El comprador mayorista no viene a armar un carrito de a una talla: viene a
 * cotizar por volumen. Es el camino que usan el hero y /cotizar — del anuncio a
 * la conversación con Arkco360 en un solo toque, en vez de producto → talla →
 * color → carrito → WhatsApp.
 */
export function construirEnlaceWhatsAppAsesor(contexto?: string, codigo?: string | null): string {
  return enlace(
    [
      "¡Hola! Quiero cotizar dotación al por mayor.",
      contexto ? `\n${contexto}` : "",
      "\n¿Me pueden asesorar?",
    ]
      .filter(Boolean)
      .join("\n"),
    codigo,
  );
}
