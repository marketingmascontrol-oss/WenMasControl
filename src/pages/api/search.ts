// Endpoint on-demand (no prerender): pensado para que Arkco360 lo consulte en
// milisegundos. Busca en Nombre_Producto, Descripcion_Corta y Categoria, apoyado
// en los índices trigram (pg_trgm) creados en supabase/schema.sql.
export const prerender = false;

import type { APIRoute } from "astro";
import type { ProductoConRelaciones } from "../../../types/product";
import { buscarProductos } from "../../lib/busqueda";
import { listarCatalogo } from "../../lib/productos";

export const GET: APIRoute = async ({ url }) => {
  const cabeceras = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  };

  const q = url.searchParams.get("q");

  const entero = (nombre: string, alterno?: string) => {
    const crudo = Number(url.searchParams.get(nombre) ?? (alterno ? url.searchParams.get(alterno) : null));
    return Number.isFinite(crudo) && crudo >= 0 ? Math.trunc(crudo) : null;
  };

  // Dos consumidores con necesidades opuestas, y por eso el tope es distinto:
  //
  //  · EL BOT pide de a pocos. Cada resultado es texto que tiene que leer y
  //    pagar, y veinte cascos en un mensaje de WhatsApp no los lee nadie.
  //  · EL PANEL del comerciante pide su catálogo entero, de a páginas: 151
  //    productos no entran en una sola pantalla pero él quiere verlos todos.
  //
  // El tope de 20 estaba pensado sólo para el primero y dejaba al panel viendo
  // apenas una parte de la tienda. Sube a 60 por página, con `offset` para
  // recorrer el resto.
  const limiteCrudo = entero("limite", "limit");
  const limite = limiteCrudo && limiteCrudo > 0 ? Math.min(limiteCrudo, 60) : null;
  const offset = entero("offset") ?? 0;

  try {
    if (q) {
      const encontrados = await buscarProductos(q);
      const pagina = encontrados.slice(offset, limite ? offset + limite : undefined);
      return new Response(JSON.stringify({
        resultados: pagina.map(liviano),
        total: encontrados.length,
      }), { headers: cabeceras });
    }

    // SIN BÚSQUEDA SE LISTA EL CATÁLOGO, no una muestra al azar.
    //
    // Antes devolvía destacados —productos aleatorios— y por eso el panel del
    // comerciante mostraba ocho cosas distintas en cada recarga en vez de su
    // tienda. «Mostrame qué venden» y «mostrame mi catálogo» son la misma
    // pregunta, y la respuesta honesta es el catálogo, ordenado y paginado.
    const { productos, total } = await listarCatalogo(limite ?? 24, offset);
    return new Response(JSON.stringify({
      resultados: productos.map(liviano),
      total,
    }), { headers: cabeceras });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: cabeceras,
    });
  }
};

// Forma liviana para Arkco360: no el objeto ProductoConRelaciones completo.
//
// 🔴 07/09/2026 · ACÁ FALTABAN LAS TALLAS, Y EL BOT LAS INVENTABA.
// `stock` es el agregado que mantiene el trigger sobre `producto_variantes`, así
// que Arkco recibía «500» y ninguna talla. Un cliente preguntaba «¿qué tallas
// manejan?» y el modelo contestaba de memoria: cuatro respuestas distintas para
// el mismo jean en tres días, y a uno que pidió la **46** —que no existe, el
// jean llega hasta la 38— se le cobró igual.
//
// ⚖️ Se manda `talla`, `color` y `stock` por variante, no sólo la lista de
// tallas: el bot tiene que poder decir «de la 32 quedan 46» y no sólo «existe».
// Y `stock: 0` viaja a propósito — una talla agotada no es una talla que no
// existe, y son dos respuestas distintas para el cliente.
function liviano(p: ProductoConRelaciones) {
  return {
    sku: p.sku,
    nombre: p.nombre,
    slug: p.slug,
    precio: p.precio,
    stock: p.stock,
    descripcion_corta: p.descripcion_corta,
    categoria: p.categoria ? { nombre: p.categoria.nombre, slug: p.categoria.slug } : null,
    imagen: (p.imagenes.find((img) => img.es_principal) ?? p.imagenes[0])?.url ?? null,
    variantes: (p.variantes ?? []).map((v) => ({
      talla: v.talla, color: v.color, stock: v.stock,
    })),
  };
}
