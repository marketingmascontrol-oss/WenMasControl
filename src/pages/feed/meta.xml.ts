import type { APIRoute } from "astro";
import { obtenerProductos } from "../../lib/productos";
import { construirFeed } from "../../lib/feed";

export const prerender = false;

// Feed para el catálogo de Meta (Commerce Manager -> Catálogo -> Fuentes de
// datos -> Feed programado). Es el que habilita Advantage+ de catálogo.
//
// Requisito para que funcione: el `content_ids` que manda el píxel en
// ViewContent y AddToCart tiene que ser el MISMO SKU que el `g:id` de acá. Si
// uno manda el SKU y el otro el UUID de Supabase, Meta no empareja nada y las
// campañas de catálogo dejan de mostrar el producto que la persona vio.
export const GET: APIRoute = async () => {
  const productos = await obtenerProductos();

  return new Response(construirFeed(productos, "meta"), {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
};
