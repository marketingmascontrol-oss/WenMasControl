// Endpoint on-demand (no prerender): precio y stock "en vivo", para que nadie
// —ni una PDP estática ni el bot— hable de disponibilidad desactualizada frente
// a un comprador B2B.
//
// Su consumidor real es Arkco360. Cuando alguien cierra la compra con el botón
// «Pagar por WhatsApp», al bot le llega un texto con SKU, y este endpoint es lo
// que le permite responder con el nombre y el precio del producto en vez de
// adivinarlos. Por eso devuelve la MISMA forma que /api/search: un solo shape
// para todo el catálogo.
export const prerender = false;

import type { APIRoute } from "astro";
import { supabase } from "../../../lib/supabase";

export const GET: APIRoute = async ({ params }) => {
  const sku = params.sku;
  if (!sku) {
    return new Response(JSON.stringify({ error: "SKU requerido" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { data, error } = await supabase
    .from("productos")
    // En una sola línea a propósito: supabase-js infiere los tipos parseando
    // este literal, y partirlo en dos con `+` le hace perder el rastro.
    // 🔴 `variantes` se agregó el 07/09/2026: sin ellas Arkco recibía el stock
    // agregado y ninguna talla, y el bot las inventaba. Ver la nota en
    // `/api/search`. En una sola línea a propósito, como el resto.
    .select("sku, nombre, slug, precio, stock, descripcion_corta, categoria:categorias(nombre, slug), imagenes:producto_imagenes(url, es_principal), variantes:producto_variantes(talla, color, stock)")
    .eq("sku", sku)
    .eq("activo", true)
    .maybeSingle();

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (!data) {
    return new Response(JSON.stringify({ error: "Producto no encontrado" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Misma forma liviana que /api/search: quien consuma el catálogo lee un solo
  // shape, venga de una búsqueda o de un SKU suelto.
  const imagenes = (data.imagenes ?? []) as { url: string; es_principal: boolean }[];
  // PostgREST devuelve la categoría como objeto en una relación 1-a-1, pero el
  // tipo inferido la da como arreglo. Se aceptan las dos formas para que un
  // cambio de tipado no vacíe la categoría en silencio.
  const relacion = data.categoria as unknown;
  const categoria = (Array.isArray(relacion) ? relacion[0] : relacion) as
    | { nombre: string; slug: string }
    | null
    | undefined;

  const producto = {
    sku: data.sku,
    nombre: data.nombre,
    slug: data.slug,
    precio: data.precio,
    stock: data.stock,
    descripcion_corta: data.descripcion_corta,
    categoria: categoria ? { nombre: categoria.nombre, slug: categoria.slug } : null,
    imagen: (imagenes.find((img) => img.es_principal) ?? imagenes[0])?.url ?? null,
    // Mismo shape que `/api/search`: quien consuma el catálogo lee uno solo.
    variantes: ((data.variantes ?? []) as { talla: string; color: string; stock: number }[])
      .map((v) => ({ talla: v.talla, color: v.color, stock: v.stock })),
  };

  return new Response(JSON.stringify(producto), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
    },
  });
};
