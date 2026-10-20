import { supabase } from "./supabase";
import type { ProductoConRelaciones } from "../../types/product";

const LIMITE_RESULTADOS = 20;
const MAX_TERMINOS = 4;

// El término va embebido en un filtro `.or()` de PostgREST, cuya sintaxis usa
// coma y paréntesis como separadores estructurales — se eliminan para que el
// usuario/IA no pueda alterar el filtro con esos caracteres.
export function sanitizarTermino(termino: string): string {
  return termino.replace(/[,()]/g, "").trim().slice(0, 80);
}

// Palabras que no aportan nada a un ILIKE y sí lo arruinan: si "necesito" tiene
// que aparecer en el nombre del producto, no hay producto que matchee.
//
// Incluye la forma en que la gente PIDE, no sólo las preposiciones. Da igual que
// venga de un buscador ("necesito guantes") o de un WhatsApp ("hola, tienen
// botas?"): el ruido es el mismo y se limpia en un solo lugar — acá, del lado que
// conoce el catálogo. Ningún cliente de esta API debería mantener su propia lista.
const RELLENO = new Set([
  "de", "del", "la", "el", "los", "las", "un", "una", "unos", "unas",
  "para", "por", "con", "sin", "que", "y", "o", "en", "al", "mi", "su",
  "necesito", "necesitamos", "quiero", "queremos", "busco", "buscamos",
  "tienen", "tienes", "tiene", "hay", "venden", "vende", "manejan", "maneja",
  "cotizar", "cotizacion", "cotización", "comprar", "pedir", "algo", "algun",
  "algún", "alguna", "sirva", "sirve", "bueno", "buena", "mejor", "buenos",
  "precio", "precios", "valor", "cuanto", "cuánto", "vale", "cuesta",
  "porfa", "favor", "gracias", "hola", "buenas", "buenos", "dias", "días",
  "tardes", "noches", "por_favor",
]);

export function partirEnTerminos(q: string): string[] {
  const terminos = q
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3 && !RELLENO.has(t));
  return terminos.slice(0, MAX_TERMINOS);
}

// El catálogo está cargado en singular —"GUANTE NITRILO VERDE TALLA 8"— y la
// gente busca en plural. Medido: "guante" → 19 productos, "guantes" → ninguno.
// Buscar por la raíz encuentra las dos formas, porque el ILIKE es parcial.
export function raiz(termino: string): string {
  if (termino.length > 5 && termino.endsWith("es")) return termino.slice(0, -2);
  if (termino.length > 4 && termino.endsWith("s"))  return termino.slice(0, -1);
  return termino;
}

// Búsqueda compartida por /buscar (humanos) y /api/search (Arkco360), para no
// duplicar la lógica.
//
// POR QUÉ POR PALABRAS Y NO POR FRASE. Hasta el 06/08/2026 esto hacía UN ILIKE
// con la consulta entera, y medido contra producción eso significaba:
//
//     "casco"           →  6 resultados
//     "casco obra"      →  0
//     "guantes nitrilo" →  0
//     "botas seguridad" →  0
//
// Dos palabras —lo que escribe cualquier comprador— y la tienda contestaba que
// no tiene nada. No era el catálogo: era el filtro.
//
// Ahora cada palabra tiene que aparecer en algún lado del producto (nombre,
// descripción, categoría o SKU), y se combinan con Y. "guantes nitrilo" trae los
// guantes de nitrilo; "casco obra" trae los cascos de obra. Si esa combinación
// no existe, en vez de devolver la nada se cae al término más significativo:
// mostrar cascos cuando pidieron "casco antiparras" es una respuesta; una grilla
// vacía no.
export async function buscarProductos(qCrudo: string): Promise<ProductoConRelaciones[]> {
  const q = sanitizarTermino(qCrudo);
  if (!q) return [];

  const terminos = partirEnTerminos(q);
  const palabras = terminos.length > 0 ? terminos : [q.toLowerCase()];

  // Las categorías son pocas (11) y se filtran en memoria: una consulta, y cada
  // término sabe a qué categorías apunta sin ir de nuevo a la base.
  const { data: categorias, error: errorCategorias } = await supabase
    .from("categorias")
    .select("id, nombre");

  if (errorCategorias) throw new Error(`Error buscando categorías: ${errorCategorias.message}`);

  const idsDeCategoriasQueMatchean = (termino: string): string[] =>
    (categorias ?? [])
      .filter((c) => (c.nombre ?? "").toLowerCase().includes(termino))
      .map((c) => c.id);

  const filtroDe = (termino: string): string => {
    const t = raiz(termino);
    const partes = [
      `nombre.ilike.%${t}%`,
      `descripcion_corta.ilike.%${t}%`,
      `sku.ilike.%${termino}%`, // el SKU se busca entero: no tiene plural
    ];
    const ids = idsDeCategoriasQueMatchean(t);
    if (ids.length > 0) partes.push(`categoria_id.in.(${ids.join(",")})`);
    return partes.join(",");
  };

  const traer = async (deQue: string[]): Promise<ProductoConRelaciones[]> => {
    // Un `.or()` por término: PostgREST los combina con Y, así que el producto
    // tiene que satisfacer TODAS las palabras, cada una donde sea.
    let consulta = supabase
      .from("productos")
      // `variantes` va acá por lo mismo que en `listarCatalogo`: es el camino
      // de `/api/search` con término, y sin ellas el bot de Arkco no sabe qué
      // tallas existen. Ver la nota del 07/09/2026 allá.
      .select("*, categoria:categorias(*), imagenes:producto_imagenes!inner(*), variantes:producto_variantes(*)")
      .eq("activo", true);

    for (const termino of deQue) {
      consulta = consulta.or(filtroDe(termino));
    }

    const { data, error } = await consulta.limit(LIMITE_RESULTADOS);
    if (error) throw new Error(`Error buscando productos: ${error.message}`);
    return (data ?? []) as unknown as ProductoConRelaciones[];
  };

  // Se empieza pidiendo todas las palabras y, si no hay nada, se suelta la
  // última y se prueba de nuevo. En español el núcleo va adelante —"casco de
  // obra civil" es un casco— así que soltar por el final conserva lo que la
  // persona realmente quiere. Peor caso: tres consultas más, y sólo cuando la
  // primera no encontró nada.
  for (let corte = palabras.length; corte >= 1; corte--) {
    const encontrados = await traer(palabras.slice(0, corte));
    if (encontrados.length > 0) return encontrados;
  }
  return [];
}
