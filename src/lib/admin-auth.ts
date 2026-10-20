import type { AstroCookies } from "astro";
import { ActionError } from "astro:actions";
import { crearClienteServidor } from "./supabase-server";

export interface UsuarioAdmin {
  id: string;
  email: string;
}

// Estructuralmente compatible tanto con APIContext (middleware) como con
// ActionAPIContext (Astro Actions) — solo necesitamos cookies + request.
interface ContextoConSesion {
  cookies: AstroCookies;
  request: Request;
}

function emailsAdminPermitidos(): string[] {
  return (import.meta.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e: string) => e.trim().toLowerCase())
    .filter(Boolean);
}

// Verifica sesión de Supabase Auth + que el email esté en ADMIN_EMAILS.
// Se llama tanto desde src/middleware.ts (redirect de UX en /admin/**) como
// desde CADA Astro Action de escritura: las actions no viven bajo /admin, así
// que la barrera real de seguridad es esta, no la del middleware.
export async function obtenerUsuarioAdmin(context: ContextoConSesion): Promise<UsuarioAdmin | null> {
  const supabase = crearClienteServidor(context.cookies, context.request.headers);
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user?.email) return null;

  const email = data.user.email.toLowerCase();
  if (!emailsAdminPermitidos().includes(email)) return null;

  return { id: data.user.id, email };
}

export async function requerirAdmin(context: ContextoConSesion): Promise<UsuarioAdmin> {
  const usuario = await obtenerUsuarioAdmin(context);
  if (!usuario) {
    throw new ActionError({ code: "UNAUTHORIZED", message: "No autorizado." });
  }
  return usuario;
}
