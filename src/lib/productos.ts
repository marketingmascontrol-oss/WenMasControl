import { supabase } from "./supabase";
import type { ProductoConRelaciones, Categoria } from "../../types/product";

// producto_imagenes!inner (en vez de producto_imagenes a secas) convierte el
// join en INNER: un producto sin ninguna foto queda afuera de todas las
// consultas públicas, en vez de mostrarse con el placeholder "Sin imagen".
export async function obtenerProductos(): Promise<ProductoConRelaciones[]> {
  const { data, error } = await supabase
    .from("productos")
    .select("*, categoria:categorias(*), imagenes:producto_imagenes!inner(*), variantes:producto_variantes(*)")
    .eq("activo", true);

  if (error) throw new Error(`Error consultando productos: ${error.message}`);
  return (data ?? []) as unknown as ProductoConRelaciones[];
}

// El catálogo completo, de a páginas y con el total real.
//
// POR QUÉ HACÍA FALTA. El panel de Arkco muestra al comerciante lo que el bot
// ve de su tienda, y sin paginación mostraba ocho productos al azar —los
// «destacados»— sobre un catálogo de 151. Un comerciante que abre su panel y ve
// ocho cosas distintas en cada recarga no puede confiar en lo que le muestran.
//
// Devuelve `total` porque sin él la pantalla no puede decir «24 de 151», y esa
// cifra es justamente la que responde «¿está todo mi catálogo acá?».
export async function listarCatalogo(
  limite = 24,
  offset = 0,
): Promise<{ productos: ProductoConRelaciones[]; total: number }> {
  const { data, error, count } = await supabase
    .from("productos")
    // 🔴 `variantes` FALTABA ACÁ Y EL BOT INVENTABA LAS TALLAS — 07/09/2026.
    // Este es el camino de `/api/search`, y su consumidor real es Arkco360.
    // Sin las variantes el bot recibía `stock: 500` —el agregado del trigger— y
    // ninguna talla, así que cuando un cliente preguntaba «¿qué tallas hay?»
    // se las inventaba: cuatro respuestas distintas para el mismo jean en tres
    // días. Las otras consultas de este archivo ya las traían.
    .select(
      "*, categoria:categorias(*), imagenes:producto_imagenes!inner(*), variantes:producto_variantes(*)",
      { count: "exact" },
    )
    .eq("activo", true)
    .order("nombre", { ascending: true })
    .range(offset, offset + limite - 1);

  if (error) throw new Error(`Error listando el catálogo: ${error.message}`);
  return {
    productos: (data ?? []) as unknown as ProductoConRelaciones[],
    total: count ?? 0,
  };
}

export async function obtenerProductoPorSlug(
  slug: string
): Promise<ProductoConRelaciones | null> {
  const { data, error } = await supabase
    .from("productos")
    .select("*, categoria:categorias(*), imagenes:producto_imagenes!inner(*), variantes:producto_variantes(*)")
    .eq("slug", slug)
    .eq("activo", true)
    .maybeSingle();

  if (error) throw new Error(`Error consultando producto "${slug}": ${error.message}`);
  return data as unknown as ProductoConRelaciones | null;
}

export async function obtenerCategorias(): Promise<Categoria[]> {
  // Las apagadas ya no llegan: la política de lectura pública sólo deja ver
  // `activa = true` (ver supabase/migrations/20261020000000_vitrina.sql).
  const { data, error } = await supabase
    .from("categorias")
    .select("*")
    .order("orden")
    .order("nombre");
  if (error) throw new Error(`Error consultando categorías: ${error.message}`);
  return data ?? [];
}

export async function obtenerCategoriaPorSlug(slug: string): Promise<Categoria | null> {
  const { data, error } = await supabase
    .from("categorias")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw new Error(`Error consultando categoría "${slug}": ${error.message}`);
  return data;
}

export async function obtenerProductosPorCategoria(
  categoriaId: string
): Promise<ProductoConRelaciones[]> {
  const { data, error } = await supabase
    .from("productos")
    .select("*, categoria:categorias(*), imagenes:producto_imagenes!inner(*), variantes:producto_variantes(*)")
    .eq("categoria_id", categoriaId)
    .eq("activo", true);

  if (error) throw new Error(`Error consultando productos de categoría: ${error.message}`);
  return (data ?? []) as unknown as ProductoConRelaciones[];
}

function mezclar<T>(lista: T[]): T[] {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

// Primero lo que el cliente marcó como destacado en el panel; si no alcanza,
// se completa con una selección al azar de productos con foto — distinta en
// cada visita, para que la home no muestre siempre lo mismo.
export async function obtenerProductosDestacados(limite = 8): Promise<ProductoConRelaciones[]> {
  const { data: pool, error: errorPool } = await supabase
    .from("productos")
    .select("id, destacado, producto_imagenes!inner(id)")
    .eq("activo", true);

  if (errorPool) throw new Error(`Error consultando productos destacados: ${errorPool.message}`);
  if (!pool || pool.length === 0) return [];

  const elegidos = mezclar(pool.filter((p) => p.destacado).map((p) => p.id));
  const relleno = mezclar(pool.filter((p) => !p.destacado).map((p) => p.id));
  const idsElegidos = [...elegidos, ...relleno].slice(0, limite);

  const { data, error } = await supabase
    .from("productos")
    .select("*, categoria:categorias(*), imagenes:producto_imagenes!inner(*), variantes:producto_variantes(*)")
    .in("id", idsElegidos);

  if (error) throw new Error(`Error consultando productos destacados: ${error.message}`);
  return (data ?? []) as unknown as ProductoConRelaciones[];
}

export async function obtenerProductosEnPromocion(limite?: number): Promise<ProductoConRelaciones[]> {
  let query = supabase
    .from("productos")
    .select("*, categoria:categorias(*), imagenes:producto_imagenes!inner(*), variantes:producto_variantes(*)")
    .eq("activo", true)
    .eq("en_promocion", true)
    .order("created_at", { ascending: false });

  if (limite) query = query.limit(limite);

  const { data, error } = await query;
  if (error) throw new Error(`Error consultando promociones: ${error.message}`);
  return (data ?? []) as unknown as ProductoConRelaciones[];
}
