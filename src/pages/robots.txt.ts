import type { APIRoute } from "astro";
import { SITE } from "../lib/site";

// robots.txt generado, no escrito a mano.
//
// POR QUÉ. Era un archivo estático en public/ con el dominio escrito adentro, y
// cuando el dominio principal cambió quedó anunciando el sitemap del otro — o
// sea, contradiciendo al canónico de todas las páginas. Un buscador que recibe
// dos señales opuestas elige él, y elige mal.
//
// Ahora sale de SITE.url, el mismo valor del que salen los canónicos y el
// sitemap: un solo lugar donde decir cuál es el dominio de esta tienda.
export const GET: APIRoute = () => new Response(
  [
    "User-agent: *",
    "Disallow: /admin",
    "Allow: /",
    "",
    `Sitemap: ${SITE.url}/sitemap.xml`,
    "",
  ].join("\n"),
  { headers: { "Content-Type": "text/plain; charset=utf-8" } },
);
