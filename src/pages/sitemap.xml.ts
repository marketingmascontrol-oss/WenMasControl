import type { APIRoute } from "astro";
import { obtenerProductos, obtenerCategorias } from "../lib/productos";
import { SITE } from "../lib/site";

export const prerender = false;

// No usamos @astrojs/sitemap: el catálogo entero vive en Supabase y se
// resuelve on-demand (ver nota en astro.config.mjs), así que ese endpoint
// arma el XML consultando la base en cada request en vez de depender de
// rutas estáticas conocidas en build time.
const PAGINAS_ESTATICAS = [
  "/",
  "/cotizar",
  "/categorias",
  "/promociones",
  "/contacto",
  "/preguntas-frecuentes",
  "/proveedores",
  "/politica-tratamiento-datos",
];

function urlXml(loc: string, lastmod?: string): string {
  return `  <url>\n    <loc>${loc}</loc>\n${lastmod ? `    <lastmod>${lastmod}</lastmod>\n` : ""}  </url>`;
}

export const GET: APIRoute = async () => {
  const [productos, categorias] = await Promise.all([obtenerProductos(), obtenerCategorias()]);

  const entradas = [
    ...PAGINAS_ESTATICAS.map((ruta) => urlXml(`${SITE.url}${ruta}`)),
    ...categorias.map((categoria) => urlXml(`${SITE.url}/categorias/${categoria.slug}`)),
    ...productos.map((producto) =>
      urlXml(`${SITE.url}/productos/${producto.slug}`, producto.updated_at?.slice(0, 10)),
    ),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entradas.join("\n")}\n</urlset>`;

  return new Response(xml, {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
};
