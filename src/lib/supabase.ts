import { createClient } from "@supabase/supabase-js";

// Cliente de solo lectura: usa la anon key. Nunca importar la service_role
// key aquí — esa queda reservada al script de importación (scripts/import-productos.ts).
const url = import.meta.env.SUPABASE_URL;
const anonKey = import.meta.env.SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    "Faltan SUPABASE_URL / SUPABASE_ANON_KEY. Copia .env.example a .env y complétalo."
  );
}

export const supabase = createClient(url, anonKey);
