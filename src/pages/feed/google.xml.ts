import type { APIRoute } from "astro";
import { obtenerProductos } from "../../lib/productos";
import { construirFeed } from "../../lib/feed";

export const prerender = false;

// Feed para Google Merchant Center. Se carga en Merchant Center como "fuente de
// datos programada" apuntando a esta URL, con actualización diaria: el catálogo
// vive en Supabase y cambia desde el panel, así que un feed subido a mano
// quedaría viejo al día siguiente.
export const GET: APIRoute = async () => {
  const productos = await obtenerProductos();

  return new Response(construirFeed(productos, "google"), {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      // Los robots de Merchant Center leen una vez al día; una hora de caché
      // evita que un rastreo intermedio golpee Supabase por cada producto.
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
};
