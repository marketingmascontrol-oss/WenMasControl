import { createServerClient, parseCookieHeader } from "@supabase/ssr";
import type { AstroCookies } from "astro";

// Cliente de Supabase con sesión basada en cookies, para las páginas y Astro
// Actions de /admin. Usa la anon key: la identidad viene de la cookie de
// sesión (Supabase Auth), no de un secreto — el service_role key vive aparte
// en src/lib/supabase-admin.ts para las escrituras reales al catálogo.
export function crearClienteServidor(cookies: AstroCookies, headers: Headers) {
  const url = import.meta.env.SUPABASE_URL;
  const anonKey = import.meta.env.SUPABASE_ANON_KEY;

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return parseCookieHeader(headers.get("cookie") ?? "").filter(
          (c): c is { name: string; value: string } => c.value !== undefined
        );
      },
      setAll(cookiesParaSetear) {
        for (const { name, value, options } of cookiesParaSetear) {
          cookies.set(name, value, options);
        }
      },
    },
  });
}
