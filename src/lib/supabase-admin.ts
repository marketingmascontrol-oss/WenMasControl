import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Cliente con service_role: bypasa RLS. Se usa SOLO desde código de servidor
// (Astro Actions, páginas /admin) para las escrituras reales del catálogo —
// el mismo principio que ya sigue scripts/import-productos.ts. Nunca importar
// esto desde un <script> de cliente.
//
// Lazy a propósito: src/actions/index.ts se carga globalmente para CUALQUIER
// página (no solo /admin), así que si esto lanzara al importarse, faltar
// SUPABASE_SERVICE_ROLE_KEY tumbaría el sitio público entero en vez de solo
// el admin. Con el Proxy, el error recién ocurre si algo intenta usarlo.
let cliente: SupabaseClient | null = null;

function crearCliente(): SupabaseClient {
  const url = import.meta.env.SUPABASE_URL;
  const serviceKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY. Completa .env para usar el admin."
    );
  }
  return createClient(url, serviceKey);
}

export const supabaseAdmin: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    if (!cliente) cliente = crearCliente();
    const valor = Reflect.get(cliente as object, prop);
    // Los métodos del cliente real (.from, .storage, etc.) esperan `this`
    // apuntando a la instancia real, no a este Proxy vacío.
    return typeof valor === "function" ? valor.bind(cliente) : valor;
  },
});
