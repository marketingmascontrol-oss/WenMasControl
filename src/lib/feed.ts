import type { ProductoConRelaciones } from "../../types/product";
import { SITE } from "./site";

// Generador de feed de productos, compartido por Google Merchant Center y por
// el catálogo de Meta. Ambos consumen el mismo RSS 2.0 con el namespace `g:`,
// así que la estructura es una sola y solo cambian los UTM de origen y un par
// de campos propios de cada plataforma.
//
// Sin feed no hay Shopping, no hay Performance Max con productos y no hay
// Advantage+ de catálogo — que para un catálogo de esta cantidad de referencias
// suele ser la campaña de mejor retorno.

const XML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&apos;",
};

function esc(valor: string): string {
  return valor.replace(/[&<>"']/g, (c) => XML_ESCAPES[c]);
}

/**
 * Quita saltos de línea y espacios repetidos, y recorta al límite del campo.
 * Merchant Center rechaza descripciones con marcado o con saltos sueltos.
 */
function limpiar(texto: string | null | undefined, maximo: number): string {
  if (!texto) return "";
  const plano = texto.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return plano.length > maximo ? `${plano.slice(0, maximo - 1).trimEnd()}…` : plano;
}

// La taxonomía de Google es un árbol en inglés. Se mapea al nodo del que
// estamos seguros y el detalle fino se refina desde Merchant Center, que
// además reclasifica solo. `product_type` (abajo) lleva la categoría real de
// Wincol y es la que se usa para segmentar campañas por categoría.
const CATEGORIA_PPE = "Business & Industrial > Work Safety Protective Gear";

const CATEGORIA_GOOGLE: Record<string, string> = {
  "calzado-de-seguridad": "Apparel & Accessories > Shoes",
  "proteccion-de-cabeza": `${CATEGORIA_PPE} > Hardhats`,
  "proteccion-visual": `${CATEGORIA_PPE} > Protective Eyewear`,
  "proteccion-respiratoria": `${CATEGORIA_PPE} > Protective Masks`,
  "proteccion-de-manos": `${CATEGORIA_PPE} > Safety Gloves`,
  "primeros-auxilios": "Health & Beauty > Health Care > First Aid",
  senalizacion: "Business & Industrial > Signage",
};

export type Plataforma = "google" | "meta";

const UTM: Record<Plataforma, string> = {
  google: "utm_source=google&utm_medium=cpc&utm_campaign=shopping",
  meta: "utm_source=meta&utm_medium=paid&utm_campaign=catalogo",
};

function enlaceProducto(producto: ProductoConRelaciones, plataforma: Plataforma): string {
  return `${SITE.url}/productos/${producto.slug}?${UTM[plataforma]}`;
}

function imagenes(producto: ProductoConRelaciones): string[] {
  const ordenadas = [...producto.imagenes].sort((a, b) => {
    if (a.es_principal !== b.es_principal) return a.es_principal ? -1 : 1;
    return a.orden - b.orden;
  });

  return ordenadas
    .map((img) => (img.url.startsWith("http") ? img.url : `${SITE.url}${img.url}`))
    .filter((url, i, todas) => todas.indexOf(url) === i);
}

function item(producto: ProductoConRelaciones, plataforma: Plataforma): string | null {
  const fotos = imagenes(producto);

  // Un producto sin foto o sin precio se rechaza del otro lado igual: es mejor
  // no mandarlo que acumular errores en la cuenta.
  if (fotos.length === 0 || !producto.precio || producto.precio <= 0) return null;

  const descripcion =
    limpiar(producto.descripcion_larga, 5000) ||
    limpiar(producto.descripcion_corta, 5000) ||
    `${producto.nombre}. Dotación y elementos de protección personal al por mayor.`;

  const campos: string[] = [
    `<g:id>${esc(producto.sku)}</g:id>`,
    `<title>${esc(limpiar(producto.nombre, 150))}</title>`,
    `<description>${esc(descripcion)}</description>`,
    `<link>${esc(enlaceProducto(producto, plataforma))}</link>`,
    `<g:image_link>${esc(fotos[0])}</g:image_link>`,
    ...fotos.slice(1, 11).map((url) => `<g:additional_image_link>${esc(url)}</g:additional_image_link>`),
    `<g:availability>${producto.stock > 0 ? "in stock" : "out of stock"}</g:availability>`,
    `<g:condition>new</g:condition>`,
    // Merchant Center exige el precio con moneda ISO y sin separadores.
    `<g:price>${producto.precio.toFixed(2)} COP</g:price>`,
    // La marca es obligatoria. +Control como respaldo mientras se completa el
    // campo en el panel — ver la columna `marca` en productos.
    `<g:brand>${esc(producto.marca?.trim() || SITE.nombre)}</g:brand>`,
    `<g:mpn>${esc(producto.sku)}</g:mpn>`,
    // Sin códigos GTIN del fabricante cargados. Declararlo explícitamente evita
    // que Merchant Center rechace el producto por identificador faltante.
    // Cuando se carguen GTIN reales, este campo se quita.
    `<g:identifier_exists>no</g:identifier_exists>`,
  ];

  if (producto.categoria) {
    const google = CATEGORIA_GOOGLE[producto.categoria.slug] ?? CATEGORIA_PPE;
    campos.push(`<g:google_product_category>${esc(google)}</g:google_product_category>`);

    const propia = producto.sub_categoria
      ? `${producto.categoria.nombre} > ${producto.sub_categoria}`
      : producto.categoria.nombre;
    campos.push(`<g:product_type>${esc(propia)}</g:product_type>`);
  }

  return `    <item>\n${campos.map((c) => `      ${c}`).join("\n")}\n    </item>`;
}

/** Arma el XML completo del feed para la plataforma indicada. */
export function construirFeed(
  productos: ProductoConRelaciones[],
  plataforma: Plataforma,
): string {
  const items = productos
    .map((producto) => item(producto, plataforma))
    .filter((linea): linea is string => linea !== null);

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">',
    "  <channel>",
    `    <title>${esc(SITE.nombre)} — Catálogo</title>`,
    `    <link>${SITE.url}</link>`,
    `    <description>${esc(SITE.descripcion)}</description>`,
    ...items,
    "  </channel>",
    "</rss>",
  ].join("\n");
}
