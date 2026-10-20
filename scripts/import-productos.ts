/**
 * Importa "Plantilla Productos .xlsx" + carpeta local de imágenes hacia Supabase.
 *
 * Uso:
 *   npm run import -- ./data/Plantilla-Productos.xlsx ./data/imagenes
 *
 * Requiere en .env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { extname, basename, join } from "node:path";
import * as XLSX from "xlsx";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import "dotenv/config";
import type { ExcelProductoRow, FilaValidada } from "../types/product";
import { slugify } from "../src/lib/slug";
import { convertirYSubirImagen } from "../src/lib/imagenes";

// Solo estas 4 no tienen un valor por defecto razonable: sin SKU/nombre/descripciones
// no hay producto que publicar. Precio, Stock, Categoria e Imagenes_Galeria sí tienen
// manejo de datos faltantes más abajo (normalizarFila / resolverImagenes).
const COLUMNAS_REQUERIDAS = [
  "SKU",
  "Nombre_Producto",
  "Descripcion_Corta",
  "Descripcion_Larga",
] as const;

// Valores por defecto acordados para datos faltantes en el Excel real (ver conversación):
const CATEGORIA_POR_DEFECTO = "Sin categoría";
const STOCK_POR_DEFECTO = 10;
const PRECIO_POR_DEFECTO = 0;

// --- Talla/color: el Excel no trae columnas estructuradas para esto, así que
// se extraen de Descripcion_Corta + Descripcion_Larga con los patrones reales
// encontrados en la plantilla (rangos "TALLA 28 HASTA LA 38", listas
// "TALLA 8-9-10", rangos de letra "TALLA S HASTA LA XL", colores como líneas
// con emoji). Si no se detecta nada, el producto cae a una sola variante
// "Única"/"Único" con todo el stock — igual que un producto sin variantes reales.
const ORDEN_TALLAS_LETRA = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "XXXL", "XXXXL"];

function rangoNumerico(desde: number, hasta: number): string[] {
  const [ini, fin] = desde <= hasta ? [desde, hasta] : [hasta, desde];
  const resultado: string[] = [];
  for (let i = ini; i <= fin; i++) resultado.push(String(i));
  return resultado;
}

function rangoLetras(desde: string, hasta: string): string[] | null {
  const i = ORDEN_TALLAS_LETRA.indexOf(desde);
  const j = ORDEN_TALLAS_LETRA.indexOf(hasta);
  if (i === -1 || j === -1) return null;
  const [ini, fin] = i <= j ? [i, j] : [j, i];
  return ORDEN_TALLAS_LETRA.slice(ini, fin + 1);
}

export function extraerTallas(texto: string): string[] {
  const t = texto.toUpperCase();

  // Lista discreta: "TALLA 8-9-10"
  const lista = t.match(/TALLAS?\s+(\d+(?:\s*-\s*\d+){1,})/);
  if (lista) {
    return lista[1].split("-").map((n) => n.trim()).filter(Boolean);
  }

  // Rango numérico: "TALLA(S) (DE LA)? 28 HASTA (LA)? (TALLA)? 38" / "... 28 A LA 38"
  const rangoNum = t.match(
    /TALLAS?\s*(?:DE\s+LA\s+)?(\d+)\s*(?:HASTA(?:\s+LA)?|A\s+LA)\s*(?:TALLA\s*)?(\d+)/
  );
  if (rangoNum) {
    return rangoNumerico(Number(rangoNum[1]), Number(rangoNum[2]));
  }

  // Rango de letras: "TALLA S HASTA LA XL"
  const rangoLetra = t.match(
    /TALLAS?\s*(?:DE\s+LA\s+)?\b(XXS|XS|S|M|L|XL|XXL|XXXL|XXXXL)\b\s*(?:HASTA(?:\s+LA)?|A\s+LA)\s*(?:TALLA\s*)?\b(XXS|XS|S|M|L|XL|XXL|XXXL|XXXXL)\b/
  );
  if (rangoLetra) {
    const rango = rangoLetras(rangoLetra[1], rangoLetra[2]);
    if (rango) return rango;
  }

  return [];
}

// Whitelist explícita de emoji "bolita/cuadrito de color" realmente usados en
// el Excel para marcar colores. OJO: \p{Extended_Pictographic} (el intento
// original) también matchea símbolos como "®" (Kevlar®, Bizweld®), que no son
// marcadores de color — con esa property, "Fabricado en tela Bizweld® ..."
// hacía que se capturara el resto del párrafo entero como si fuera un color.
const EMOJI_COLOR = "⚫🔵🟤🟡⚪🟢🔴🔷🩶🟣🟠";
const PATRON_COLOR = new RegExp(`[${EMOJI_COLOR}]\\s*([^\\n${EMOJI_COLOR}]+)`, "gu");

export function extraerColores(texto: string): string[] {
  const coincidencias = [...texto.matchAll(PATRON_COLOR)];
  const colores = coincidencias
    .map((m) => m[1].replace(/\s+/g, " ").trim())
    // corta cualquier resto de "(TALLA ...)" que haya quedado pegado al color
    // cuando el orden en el texto es "color" antes de "talla" (ej. "Blanco (TALLA S HASTA LA XL)")
    .map((c) => c.replace(/\(?\s*TALLAS?\b.*$/i, "").trim())
    // red de seguridad: un nombre de color real es corto; si algo quedó mal
    // capturado (una oración completa), se corta en el primer punto seguido
    .map((c) => c.split(/\.\s/)[0].trim())
    .filter((c) => c && c.length <= 40)
    // normaliza mayúsculas ("AZUL OscurO" -> "Azul Oscuro") para no terminar
    // con la misma variante duplicada por diferencias de capitalización.
    // OJO: no se usa \b (en JS es ASCII-only y no reconoce letras acentuadas
    // como "í", lo que capitalizaba mal "Índigo" -> "íNdigo").
    .map((c) =>
      c.toLowerCase().replace(/(^|[\s(])(\p{L})/gu, (_, pre, letra) => pre + letra.toUpperCase())
    );
  return [...new Set(colores)];
}

// Una vez que talla/color quedaron representados como variantes seleccionables,
// no tiene sentido que el cliente los vea también como texto crudo (rangos de
// talla entre paréntesis, líneas de emoji) en la descripción del producto.
export function limpiarTallaColor(texto: string): string {
  let limpio = texto;

  // Cualquier paréntesis que mencione "TALLA" se remueve completo: cubre todas
  // las variantes de redacción encontradas ("viene desde la talla X hasta la
  // talla Y", "TALLAS DE LA X A LA Y", "TALLA X-Y-Z", "TALLA S HASTA LA XL"...).
  limpio = limpio.replace(/\([^()]*\bTALLAS?\b[^()]*\)/gi, "");

  // Mismo patrón pero sin paréntesis (ej. botas: ". TALLA 35 HASTA LA 46").
  limpio = limpio.replace(
    /TALLAS?\s*(?:DE\s+LA\s+)?(?:\d+(?:\s*-\s*\d+)+|\d+\s*(?:HASTA(?:\s+LA)?|A\s+LA)\s*(?:TALLA\s*)?\d+|(?:XXXXL|XXXL|XXL|XL|XXS|XS|S|M|L)\s*(?:HASTA(?:\s+LA)?|A\s+LA)\s*(?:TALLA\s*)?(?:XXXXL|XXXL|XXL|XL|XXS|XS|S|M|L))/gi,
    ""
  );

  // Colores como líneas "emoji + nombre" (misma whitelist que extraerColores).
  limpio = limpio.replace(new RegExp(`[${EMOJI_COLOR}]\\s*[^\\n${EMOJI_COLOR}]+`, "gu"), "");

  // Colapsa los espacios/saltos de línea y puntos duplicados que deja el texto removido.
  return limpio
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .replace(/\s+([.,])/g, "$1")
    .replace(/\.\s*\./g, ".")
    .trim();
}

interface VarianteGenerada {
  talla: string;
  color: string;
  stock: number;
}

// Reparte el stock total en partes iguales entre todas las combinaciones
// talla×color detectadas (acordado con el cliente: son cifras estimadas,
// no un conteo real por combinación — se ajustan luego desde el admin).
export function generarVariantes(
  tallas: string[],
  colores: string[],
  stockTotal: number
): VarianteGenerada[] {
  const t = tallas.length > 0 ? tallas : ["Única"];
  const c = colores.length > 0 ? colores : ["Único"];
  const combinaciones = t.flatMap((talla) => c.map((color) => ({ talla, color })));

  const base = Math.floor(stockTotal / combinaciones.length);
  const resto = stockTotal % combinaciones.length;
  return combinaciones.map((combo, i) => ({ ...combo, stock: base + (i < resto ? 1 : 0) }));
}

function leerExcel(rutaExcel: string): ExcelProductoRow[] {
  const buffer = readFileSync(rutaExcel);
  const libro = XLSX.read(buffer, { type: "buffer" });
  // Si el libro tiene una hoja "FINAL", es la versión curada a usar; si no, la primera.
  const nombreHoja = libro.SheetNames.includes("FINAL") ? "FINAL" : libro.SheetNames[0];
  const hoja = libro.Sheets[nombreHoja];
  return XLSX.utils.sheet_to_json<ExcelProductoRow>(hoja, { defval: "" });
}

// Convierte formatos de moneda colombiana ("$ 75.000,00", "75.000") a número.
// "." es separador de miles y "," es separador decimal. Valores como "N/A"
// quedan como NaN a propósito: no se puede inventar un precio/stock real.
function parsearMoneda(valor: string | number): number {
  if (typeof valor === "number") return valor;
  const limpio = valor
    .replace(/\s/g, "")
    .replace(/^\$/, "")
    .replace(/\./g, "")
    .replace(",", ".");
  return Number(limpio);
}

interface FilaNormalizada {
  data: ExcelProductoRow;
  advertencias: string[];
}

// Aplica los valores por defecto acordados para Precio/Stock/Categoria faltantes
// o con formato inválido (moneda colombiana, "N/A", celdas vacías). Cada default
// queda registrado en `advertencias` para que sea trazable, nunca silencioso.
function normalizarFila(dataCruda: ExcelProductoRow): FilaNormalizada {
  const advertencias: string[] = [];
  const data = { ...dataCruda };

  const precio = parsearMoneda(data.Precio);
  if (Number.isNaN(precio)) {
    advertencias.push(`Precio inválido ("${data.Precio}"), se usó $${PRECIO_POR_DEFECTO} temporal`);
    data.Precio = PRECIO_POR_DEFECTO;
  } else {
    data.Precio = precio;
  }

  const stockCrudo = String(data.Stock ?? "").trim();
  const stock = stockCrudo ? parsearMoneda(data.Stock) : NaN;
  if (Number.isNaN(stock)) {
    advertencias.push(`Stock vacío o inválido, se usó ${STOCK_POR_DEFECTO} temporal`);
    data.Stock = STOCK_POR_DEFECTO;
  } else {
    data.Stock = stock;
  }

  if (!data.Categoria?.trim()) {
    advertencias.push(`Sin categoría, se asignó "${CATEGORIA_POR_DEFECTO}"`);
    data.Categoria = CATEGORIA_POR_DEFECTO;
  }

  return { data, advertencias };
}

function validarFilas(filas: ExcelProductoRow[]): FilaValidada[] {
  // SKU duplicado con datos distintos entre filas = error del Excel, no algo
  // que debamos resolver adivinando cuál fila es la "buena": se omiten todas
  // las filas con ese SKU y se reporta, en vez de que la última pise a la
  // primera en silencio durante el upsert.
  const conteoSku = new Map<string, number>();
  for (const data of filas) {
    const sku = data.SKU?.trim();
    if (sku) conteoSku.set(sku, (conteoSku.get(sku) ?? 0) + 1);
  }

  return filas.map((data, i) => {
    const errores: string[] = [];
    const numeroFila = i + 2; // +1 por índice base 0, +1 por fila de encabezado

    for (const columna of COLUMNAS_REQUERIDAS) {
      if (data[columna] === undefined || data[columna] === "") {
        errores.push(`Falta la columna "${columna}"`);
      }
    }

    const sku = data.SKU?.trim();
    if (sku && (conteoSku.get(sku) ?? 0) > 1) {
      errores.push(`SKU duplicado en el Excel (aparece ${conteoSku.get(sku)} veces con datos distintos)`);
    }

    return { fila: numeroFila, ok: errores.length === 0, errores, data };
  });
}

function normalizarNombreArchivo(texto: string): string {
  return texto
    .normalize("NFC")
    .trim()
    .toLowerCase()
    .replace(/\//g, ""); // "/" no puede existir en nombres de archivo reales
}

// Fallback cuando la columna Imagenes_Galeria viene vacía: busca en la carpeta
// archivos cuyo nombre (sin extensión) coincida con el SKU. También adjunta
// variantes "SKU (2).ext", "SKU (3).ext"... como fotos adicionales de galería.
function resolverImagenesPorSku(sku: string, carpetaImagenes: string): string[] {
  const archivos = readdirSync(carpetaImagenes);
  const skuNormalizado = normalizarNombreArchivo(sku);

  const coincidencias = archivos.filter((archivo) => {
    const base = normalizarNombreArchivo(basename(archivo, extname(archivo)));
    return base === skuNormalizado || base.startsWith(`${skuNormalizado} (`);
  });

  return coincidencias.sort((a, b) => a.length - b.length);
}

function resolverImagenes(fila: ExcelProductoRow, carpetaImagenes: string): string[] {
  const nombresGaleria = fila.Imagenes_Galeria?.trim();

  if (nombresGaleria) {
    return nombresGaleria
      .split(/[|,]/)
      .map((n) => n.trim())
      .filter(Boolean)
      .filter((nombreArchivo) => {
        const existe = existsSync(join(carpetaImagenes, nombreArchivo));
        if (!existe) {
          console.warn(`  ⚠ imagen no encontrada en disco: ${nombreArchivo}`);
        }
        return existe;
      });
  }

  const porSku = resolverImagenesPorSku(fila.SKU.trim(), carpetaImagenes);
  if (porSku.length === 0) {
    console.warn(`  ⚠ SKU ${fila.SKU}: sin Imagenes_Galeria y sin archivo coincidente en disco`);
  }
  return porSku;
}

async function subirImagen(
  supabase: SupabaseClient,
  carpetaImagenes: string,
  sku: string,
  nombreArchivo: string,
  orden: number
): Promise<string | null> {
  const rutaLocal = join(carpetaImagenes, nombreArchivo);
  const ext = extname(nombreArchivo);
  const nombreBase = basename(nombreArchivo, ext);

  try {
    const bufferOriginal = readFileSync(rutaLocal);
    return await convertirYSubirImagen(supabase, bufferOriginal, `${sku}/${orden}-${nombreBase}`);
  } catch (err) {
    console.error(`  ✗ error procesando ${nombreArchivo}: ${(err as Error).message}`);
    return null;
  }
}

function imprimirReporteDryRun(
  filasCrudas: ExcelProductoRow[],
  filasNormalizadas: FilaNormalizada[],
  filasValidadas: FilaValidada[],
  carpetaImagenes: string
) {
  const invalidas = filasValidadas.filter((f) => !f.ok);
  const validas = filasValidadas.filter((f) => f.ok).map((f) => f.data!);

  console.log(`\n=== REPORTE (--dry-run, no se escribió nada en Supabase) ===\n`);
  console.log(`Filas totales en el Excel: ${filasCrudas.length}`);
  console.log(`Filas válidas:             ${validas.length}`);
  console.log(`Filas con errores:         ${invalidas.length}`);

  if (invalidas.length > 0) {
    const conteoErrores = new Map<string, number>();
    for (const f of invalidas) {
      for (const err of f.errores) {
        conteoErrores.set(err, (conteoErrores.get(err) ?? 0) + 1);
      }
    }
    console.log("\nErrores por tipo (bloquean la fila, no tienen default):");
    for (const [err, n] of [...conteoErrores].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${n}x  ${err}`);
    }
  }

  const conteoAdvertencias = new Map<string, number>();
  for (const f of filasNormalizadas) {
    for (const adv of f.advertencias) {
      const clave = adv.replace(/\(".*?"\)/, "(...)");
      conteoAdvertencias.set(clave, (conteoAdvertencias.get(clave) ?? 0) + 1);
    }
  }
  if (conteoAdvertencias.size > 0) {
    console.log("\nValores por defecto aplicados (datos faltantes/ inválidos en el Excel):");
    for (const [adv, n] of [...conteoAdvertencias].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${n}x  ${adv}`);
    }
  }

  const categorias = [...new Set(filasNormalizadas.map((f) => f.data.Categoria.trim()))];
  console.log(`\nCategorías finales (${categorias.length}): ${categorias.join(", ")}`);

  let conVariantesReales = 0;
  let soloVarianteUnica = 0;
  const ejemplosVariantes: string[] = [];
  for (const f of validas) {
    const texto = `${f.Descripcion_Corta.trim()} ${f.Descripcion_Larga.trim()}`;
    const tallas = extraerTallas(texto);
    const colores = extraerColores(texto);
    const combinaciones = Math.max(tallas.length, 1) * Math.max(colores.length, 1);
    if (tallas.length > 0 || colores.length > 0) {
      conVariantesReales++;
      if (ejemplosVariantes.length < 25) {
        ejemplosVariantes.push(
          `${f.SKU}: tallas=[${tallas.join(",") || "-"}] colores=[${colores.join(",") || "-"}] (${combinaciones} combinaciones, stock ${f.Stock} repartido)`
        );
      }
    } else {
      soloVarianteUnica++;
    }
  }
  console.log(`\nProductos con talla/color detectado: ${conVariantesReales}`);
  console.log(`Productos con variante única (sin detección): ${soloVarianteUnica}`);
  if (ejemplosVariantes.length > 0) {
    console.log("Ejemplos de variantes detectadas:");
    for (const ej of ejemplosVariantes) console.log(`  ${ej}`);
  }

  let conImagen = 0;
  let sinImagen = 0;
  const ejemplosSinImagen: string[] = [];
  for (const fila of filasCrudas) {
    const imagenes = resolverImagenes(fila, carpetaImagenes);
    if (imagenes.length > 0) conImagen++;
    else {
      sinImagen++;
      if (ejemplosSinImagen.length < 15) ejemplosSinImagen.push(fila.SKU);
    }
  }
  console.log(`\nProductos con al menos 1 imagen encontrada: ${conImagen}`);
  console.log(`Productos SIN imagen encontrada:            ${sinImagen}`);
  if (ejemplosSinImagen.length > 0) {
    console.log(`  Ejemplos sin imagen: ${ejemplosSinImagen.join(", ")}`);
  }
  console.log("\n(nada se importó; corré sin --dry-run cuando confirmes los puntos pendientes)");
}

async function main() {
  const args = process.argv.slice(2).filter((a) => a !== "--dry-run");
  const esDryRun = process.argv.includes("--dry-run");
  const [rutaExcel, carpetaImagenes] = args;

  if (!rutaExcel || !carpetaImagenes) {
    console.error("Uso: npm run import -- <ruta-excel.xlsx> <carpeta-imagenes> [--dry-run]");
    process.exit(1);
  }
  if (!existsSync(rutaExcel)) {
    console.error(`No existe el archivo Excel: ${rutaExcel}`);
    process.exit(1);
  }
  if (!existsSync(carpetaImagenes)) {
    console.error(`No existe la carpeta de imágenes: ${carpetaImagenes}`);
    process.exit(1);
  }

  console.log(`Leyendo ${rutaExcel} ...`);
  const filasCrudas = leerExcel(rutaExcel);
  const filasNormalizadas = filasCrudas.map(normalizarFila);
  const filasValidadas = validarFilas(filasNormalizadas.map((f) => f.data));

  if (esDryRun) {
    imprimirReporteDryRun(filasCrudas, filasNormalizadas, filasValidadas, carpetaImagenes);
    return;
  }

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error("Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en .env");
    process.exit(1);
  }
  const supabase = createClient(url, serviceKey);

  const invalidas = filasValidadas.filter((f) => !f.ok);
  if (invalidas.length > 0) {
    console.error(`\n${invalidas.length} fila(s) con errores, se omitirán:`);
    for (const f of invalidas) {
      console.error(`  Fila ${f.fila}: ${f.errores.join("; ")}`);
    }
  }

  const filasValidas = filasValidadas.filter((f) => f.ok).map((f) => f.data!);
  console.log(`\n${filasValidas.length} fila(s) válidas de ${filasCrudas.length} totales.\n`);

  // 1) Categorías: upsert de las categorías únicas presentes en el Excel
  const nombresCategoria = [...new Set(filasValidas.map((f) => f.Categoria.trim()))];
  const categoriasPayload = nombresCategoria.map((nombre) => ({
    nombre,
    slug: slugify(nombre),
  }));

  const { data: categoriasInsertadas, error: errCategorias } = await supabase
    .from("categorias")
    .upsert(categoriasPayload, { onConflict: "nombre" })
    .select("id, nombre");

  if (errCategorias) {
    console.error("Error creando categorías:", errCategorias.message);
    process.exit(1);
  }
  const mapaCategorias = new Map(categoriasInsertadas!.map((c) => [c.nombre, c.id]));

  // 2) Productos: upsert por SKU
  let exitosos = 0;
  for (const fila of filasValidas) {
    const sku = fila.SKU.trim();
    const slug = slugify(fila.Nombre_Producto);

    const descripcionCortaCruda = fila.Descripcion_Corta.trim();
    const descripcionLargaCruda = fila.Descripcion_Larga.trim();
    const subCategoria = fila["Sub-Categoria"]?.trim() || null;

    // Talla/color se extraen del texto crudo (antes de limpiarlo) — ver
    // extraerTallas/extraerColores; si no se detecta nada, el producto queda
    // con una sola variante "Única"/"Único" con todo el stock.
    const textoCompleto = `${descripcionCortaCruda} ${descripcionLargaCruda}`;
    const tallas = extraerTallas(textoCompleto);
    const colores = extraerColores(textoCompleto);

    // Una vez extraídos, se guarda la descripción SIN esos rangos/emoji: ya
    // quedan representados como variantes seleccionables, no como texto suelto.
    const descripcionCorta = limpiarTallaColor(descripcionCortaCruda);
    const descripcionLarga = limpiarTallaColor(descripcionLargaCruda);

    const { data: producto, error: errProducto } = await supabase
      .from("productos")
      .upsert(
        {
          sku,
          nombre: fila.Nombre_Producto.trim(),
          slug,
          precio: Number(fila.Precio),
          stock: Number(fila.Stock),
          categoria_id: mapaCategorias.get(fila.Categoria.trim()) ?? null,
          sub_categoria: subCategoria,
          descripcion_corta: descripcionCorta,
          descripcion_larga: descripcionLarga,
          activo: true,
        },
        { onConflict: "sku" }
      )
      .select("id")
      .single();

    if (errProducto) {
      console.error(`✗ SKU ${sku}: ${errProducto.message}`);
      continue;
    }

    // 3) Variantes: se reemplazan por completo en cada import para que una
    // reimportación no deje variantes viejas huérfanas junto a las nuevas.
    // productos.stock queda derivado de la suma de variantes por trigger
    // (ver supabase/schema.sql).
    const variantesGeneradas = generarVariantes(tallas, colores, Number(fila.Stock));

    await supabase.from("producto_variantes").delete().eq("producto_id", producto.id);
    const { error: errVariantes } = await supabase.from("producto_variantes").insert(
      variantesGeneradas.map((v) => ({
        producto_id: producto.id,
        talla: v.talla,
        color: v.color,
        stock: v.stock,
      }))
    );
    if (errVariantes) {
      console.error(`  ⚠ SKU ${sku}: error creando variantes: ${errVariantes.message}`);
    }

    // 4) Imágenes: subir a Storage y reemplazar registros de galería
    const nombresImagenes = resolverImagenes(fila, carpetaImagenes);
    if (nombresImagenes.length > 0) {
      await supabase.from("producto_imagenes").delete().eq("producto_id", producto.id);

      const filasImagenes = [];
      for (let orden = 0; orden < nombresImagenes.length; orden++) {
        const publicUrl = await subirImagen(
          supabase,
          carpetaImagenes,
          sku,
          nombresImagenes[orden],
          orden
        );
        if (publicUrl) {
          filasImagenes.push({
            producto_id: producto.id,
            url: publicUrl,
            alt: `${fila.Nombre_Producto.trim()} - imagen ${orden + 1}`,
            orden,
            es_principal: orden === 0,
          });
        }
      }
      if (filasImagenes.length > 0) {
        await supabase.from("producto_imagenes").insert(filasImagenes);
      }
    }

    exitosos++;
    console.log(`✓ ${sku} — ${fila.Nombre_Producto.trim()}`);
  }

  console.log(`\nListo: ${exitosos}/${filasValidas.length} productos importados.`);
}

main().catch((err) => {
  console.error("Error fatal en la importación:", err);
  process.exit(1);
});
