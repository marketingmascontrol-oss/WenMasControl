import type { SupabaseClient } from "@supabase/supabase-js";
import sharp from "sharp";

export const BUCKET_PRODUCTOS = "productos";

// Ancho máximo de imagen: suficiente para zoom de galería PDP sin inflar el peso de página
const IMAGEN_MAX_ANCHO = 1600;
const IMAGEN_CALIDAD_WEBP = 80;

// Supabase Storage rechaza keys con caracteres no-ASCII (ej. "Ñ", tildes),
// que sí aparecen en varios SKU reales del catálogo. Solo se quitan los
// diacríticos (Ñ→N, É→E...); se preserva mayúsculas/espacios/paréntesis tal
// cual, porque esos ya funcionan hoy en las rutas de storage existentes.
function sanearRutaStorage(ruta: string): string {
  return ruta.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

// Convierte a WebP y sube al bucket "productos". La usan tanto el script de
// importación (scripts/import-productos.ts, leyendo archivos del disco) como
// la Astro Action de subida de imágenes del admin (leyendo un archivo subido
// desde el navegador) — un solo pipeline de conversión para ambos casos.
export async function convertirYSubirImagen(
  supabase: SupabaseClient,
  bufferOriginal: Buffer,
  rutaStorageSinExtension: string
): Promise<string> {
  const bufferWebp = await sharp(bufferOriginal)
    .rotate() // respeta orientación EXIF antes de convertir
    .resize({ width: IMAGEN_MAX_ANCHO, withoutEnlargement: true })
    .webp({ quality: IMAGEN_CALIDAD_WEBP })
    .toBuffer();

  const rutaStorage = `${sanearRutaStorage(rutaStorageSinExtension)}.webp`;
  const { error } = await supabase.storage
    .from(BUCKET_PRODUCTOS)
    .upload(rutaStorage, bufferWebp, { upsert: true, contentType: "image/webp" });

  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from(BUCKET_PRODUCTOS).getPublicUrl(rutaStorage);
  return data.publicUrl;
}
