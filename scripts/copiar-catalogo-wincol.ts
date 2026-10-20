/**
 * Copia el catálogo de Wincol a la base de +Control. Se corre UNA vez, al
 * arrancar; después cada sitio administra el suyo por separado.
 *
 * ⚖️ POR QUÉ COPIAR Y NO COMPARTIR. Son dos clientes. Con la base compartida,
 * un cambio de precio o de stock en el panel de Wincol se vería en +Control y
 * al revés. Copiado, el panel de +Control (/admin/vitrina) prende y apaga lo
 * suyo sin tocar a Wincol.
 *
 * Qué copia: categorías (con portada), productos, variantes e imágenes. Las
 * imágenes se descargan de Wincol y se suben al bucket propio: si se dejaran
 * apuntando a Wincol, un borrado del otro lado dejaría fotos rotas acá.
 * Qué NO copia: reseñas (son de compradores de Wincol), proveedores y atribución.
 *
 * Es idempotente: se puede volver a correr; actualiza por slug/SKU.
 *
 * Uso:
 *   npm run copiar-wincol            # copia
 *   npm run copiar-wincol -- --seco  # sólo cuenta lo que copiaría
 *
 * Requiere en .env:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY              (destino: +Control)
 *   WINCOL_SUPABASE_URL, WINCOL_SUPABASE_KEY             (origen: Wincol)
 * WINCOL_SUPABASE_KEY puede ser la anon key (copia sólo lo publicado) o la
 * service role (copia también lo oculto). Sólo se LEE de Wincol.
 */

import { createClient } from "@supabase/supabase-js";
import "dotenv/config";
import { convertirYSubirImagen } from "../src/lib/imagenes";

const seco = process.argv.includes("--seco");

function requerida(nombre: string): string {
  const v = process.env[nombre];
  if (!v) throw new Error(`Falta ${nombre} en .env`);
  return v;
}

const origen = createClient(requerida("WINCOL_SUPABASE_URL"), requerida("WINCOL_SUPABASE_KEY"));
const destino = createClient(requerida("SUPABASE_URL"), requerida("SUPABASE_SERVICE_ROLE_KEY"));

if (requerida("WINCOL_SUPABASE_URL") === requerida("SUPABASE_URL")) {
  throw new Error("Origen y destino son la misma base: revisa .env.");
}

async function copiarImagen(url: string, rutaSinExtension: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} al bajar ${url}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  return convertirYSubirImagen(destino, buffer, rutaSinExtension);
}

async function main() {
  const { data: categorias, error: e1 } = await origen.from("categorias").select("*");
  if (e1) throw e1;
  const { data: productos, error: e2 } = await origen
    .from("productos")
    .select("*, imagenes:producto_imagenes(*), variantes:producto_variantes(*)");
  if (e2) throw e2;

  console.log(`Wincol: ${categorias.length} categorías, ${productos.length} productos.`);
  if (seco) return;

  // 1. Categorías, por slug. Mapa id de Wincol → id de +Control.
  const idCategoria = new Map<string, string>();
  for (const c of categorias) {
    let imagen_url: string | null = null;
    if (c.imagen_url) {
      try {
        imagen_url = await copiarImagen(c.imagen_url, `categorias/${c.slug}`);
      } catch (err) {
        console.warn(`  ⚠️ portada de ${c.slug}: ${(err as Error).message}`);
      }
    }
    const { data, error } = await destino
      .from("categorias")
      .upsert({ nombre: c.nombre, slug: c.slug, imagen_url }, { onConflict: "slug" })
      .select("id")
      .single();
    if (error) throw new Error(`categoría ${c.slug}: ${error.message}`);
    idCategoria.set(c.id, data.id);
  }
  console.log(`✓ ${idCategoria.size} categorías`);

  // 2. Productos, por SKU, con sus variantes e imágenes.
  let ok = 0;
  const fallidos: string[] = [];
  for (const p of productos) {
    try {
      const { data: prod, error } = await destino
        .from("productos")
        .upsert(
          {
            sku: p.sku,
            nombre: p.nombre,
            slug: p.slug,
            precio: p.precio,
            categoria_id: p.categoria_id ? idCategoria.get(p.categoria_id) ?? null : null,
            descripcion_corta: p.descripcion_corta,
            descripcion_larga: p.descripcion_larga,
            sub_categoria: p.sub_categoria ?? null,
            marca: p.marca ?? null,
            activo: p.activo,
            en_promocion: p.en_promocion ?? false,
          },
          { onConflict: "sku" },
        )
        .select("id")
        .single();
      if (error) throw new Error(error.message);

      // Variantes: se reemplazan enteras (el stock del producto lo recalcula el trigger).
      await destino.from("producto_variantes").delete().eq("producto_id", prod.id);
      if (p.variantes?.length) {
        const { error: ev } = await destino.from("producto_variantes").insert(
          p.variantes.map((v: { talla: string; color: string; stock: number; orden: number }) => ({
            producto_id: prod.id,
            talla: v.talla,
            color: v.color,
            stock: v.stock,
            orden: v.orden,
          })),
        );
        if (ev) throw new Error(`variantes: ${ev.message}`);
      }

      // Imágenes: se suben al bucket propio y se reemplazan las filas.
      await destino.from("producto_imagenes").delete().eq("producto_id", prod.id);
      const imagenes = [...(p.imagenes ?? [])].sort((a, b) => a.orden - b.orden);
      for (const [i, img] of imagenes.entries()) {
        const url = await copiarImagen(img.url, `${p.sku}/${i}`);
        const { error: ei } = await destino.from("producto_imagenes").insert({
          producto_id: prod.id,
          url,
          alt: img.alt,
          orden: img.orden,
          es_principal: img.es_principal,
        });
        if (ei) throw new Error(`imagen: ${ei.message}`);
      }

      ok++;
      if (ok % 20 === 0) console.log(`  … ${ok}/${productos.length}`);
    } catch (err) {
      fallidos.push(`${p.sku}: ${(err as Error).message}`);
    }
  }

  console.log(`✓ ${ok} productos copiados`);
  if (fallidos.length) {
    console.log(`✗ ${fallidos.length} con error:`);
    fallidos.forEach((f) => console.log(`  - ${f}`));
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
