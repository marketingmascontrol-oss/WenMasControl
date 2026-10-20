import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import vercel from "@astrojs/vercel";

export default defineConfig({
  // 🔶 PENDIENTE: dominio real. Tiene que coincidir con SITE.url (src/lib/site.ts).
  site: "https://www.mascontrol.com.co",
  // "server": on-demand por defecto. El catálogo lo edita un admin en vivo
  // (precio/stock/descripciones/imágenes), así que las páginas de producto y
  // categoría consultan Supabase en cada request — sin eso, cada edición
  // requeriría un rebuild para verse en la tienda. Si algún día hace falta una
  // página puramente informativa y estática, se marca con `prerender = true`.
  //
  // El sitemap NO usa @astrojs/sitemap: esa integración solo descubre rutas
  // estáticas conocidas en build time, y acá el catálogo entero (productos,
  // categorías) vive en Supabase y se resuelve on-demand por request. Por eso
  // hay un endpoint propio en src/pages/sitemap.xml.ts que arma el XML
  // consultando la base en cada request.
  output: "server",
  adapter: vercel(),
  // allowedDomains no es solo para previews: Vercel reenvía cada request al
  // runtime con X-Forwarded-Host = el dominio público real que tipeó el
  // usuario. Astro valida ese header contra esta lista para calcular el
  // origin "de verdad"; si el dominio no está acá, el cálculo falla, no
  // calza con el header Origin del navegador, y la protección CSRF
  // (security.checkOrigin, activa por defecto) tumba el POST con
  // "Cross-site POST form submissions are forbidden" — pasó con los
  // dominios de producción reales, no solo con previews de Vercel.
  // Por eso hay que listar ACÁ todo dominio custom que apunte a este
  // proyecto en Vercel (`vercel alias ls` para verificar la lista vigente),
  // además del comodín de previews `**.vercel.app`.
  security: {
    allowedDomains: [
      { hostname: "**.vercel.app", protocol: "https" },
      { hostname: "mascontrol.com.co", protocol: "https" },
      { hostname: "www.mascontrol.com.co", protocol: "https" },
    ],
  },
  vite: {
    plugins: [tailwindcss()],
    server: {
      // Sólo afecta a `astro dev`. Vite bloquea por defecto cualquier petición
      // cuyo Host no sea localhost, y eso impide una prueba que sí hace falta:
      // la medición de Google Ads y de Meta está limitada por dominio (ver
      // src/lib/dominio.ts), así que para verificar que los eventos disparan hay
      // que servir el sitio local bajo el dominio real —mapeando el dominio a
      // 127.0.0.1 en el navegador—. Sin esta línea, Vite responde "Blocked
      // request" y la prueba parece un fallo del código cuando no lo es.
      allowedHosts: ["www.mascontrol.com.co", "mascontrol.com.co"],
    },
  },
});
