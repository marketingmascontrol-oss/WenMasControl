// Endpoint on-demand: productos sugeridos para venta cruzada en el carrito.
// No hay datos de ventas/afinidad reales todavía (ver nota en admin/index.astro
// sobre "rotación"), así que por ahora es una muestra de productos destacados
// (con foto, con stock) excluyendo lo que el cliente ya tiene en el carrito.
export const prerender = false;

import type { APIRoute } from "astro";
import { obtenerProductosDestacados } from "../../lib/productos";

export const GET: APIRoute = async ({ url }) => {
  const cabeceras = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  };

  const excluir = new Set(
    (url.searchParams.get("excluir") ?? "").split(",").map((s) => s.trim()).filter(Boolean)
  );
  const limite = Number(url.searchParams.get("limite")) || 4;

  try {
    const productos = await obtenerProductosDestacados(limite + excluir.size);
    const sugeridos = productos
      .filter((p) => !excluir.has(p.sku) && p.stock > 0)
      .slice(0, limite)
      .map((p) => ({
        sku: p.sku,
        nombre: p.nombre,
        slug: p.slug,
        precio: p.precio,
        imagen: (p.imagenes.find((img) => img.es_principal) ?? p.imagenes[0])?.url ?? null,
      }));
    return new Response(JSON.stringify({ sugeridos }), { headers: cabeceras });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: cabeceras,
    });
  }
};
