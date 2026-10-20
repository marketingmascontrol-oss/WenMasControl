import type { APIRoute } from "astro";
import { supabaseAdmin } from "../../lib/supabase-admin";
import {
  COOKIE_ATRIBUCION,
  COOKIE_REF,
  deserializarAtribucion,
} from "../../lib/atribucion";

export const prerender = false;

// Eventos que representan una intención real de conversión. Cualquier otro
// nombre se rechaza: este endpoint es público y sin esta lista se convierte en
// un buzón abierto para llenar la tabla de basura.
const EVENTOS_VALIDOS = new Set(["whatsapp_pedido", "whatsapp_consulta", "generate_lead"]);

const MAX_CUERPO = 8_000;

/**
 * Persiste una intención de conversión junto con la atribución de campaña de la
 * visita, para poder subirla después a Google Ads y Meta como conversión sin
 * conexión con su valor real.
 *
 * Lo llama `registrarIntencion()` (src/lib/medicion.ts) vía sendBeacon justo
 * antes de que el usuario se vaya a WhatsApp. Por eso responde 204 y nunca
 * hace esperar al navegador: la pestaña ya está saliendo del sitio.
 */
export const POST: APIRoute = async ({ request, cookies }) => {
  const sinContenido = () => new Response(null, { status: 204 });

  try {
    const crudo = await request.text();
    if (crudo.length > MAX_CUERPO) return sinContenido();

    const cuerpo = JSON.parse(crudo) as Record<string, unknown>;

    const evento = typeof cuerpo.evento === "string" ? cuerpo.evento : "";
    if (!EVENTOS_VALIDOS.has(evento)) return sinContenido();

    // El código y la atribución se leen de las cookies que puso el middleware,
    // NO de lo que mandó el cliente: el navegador no debería poder inventar la
    // campaña a la que se le atribuye una venta.
    const codigo = cookies.get(COOKIE_REF)?.value;
    if (!codigo) return sinContenido();

    const atribucion = deserializarAtribucion(cookies.get(COOKIE_ATRIBUCION)?.value);

    const valor = Number(cuerpo.valor_estimado);

    const { error } = await supabaseAdmin.from("atribucion").insert({
      codigo,
      evento,
      params: atribucion?.params ?? {},
      landing: atribucion?.landing ?? null,
      referrer: atribucion?.referrer ?? null,
      origen: typeof cuerpo.origen === "string" ? cuerpo.origen.slice(0, 64) : null,
      user_agent: request.headers.get("user-agent")?.slice(0, 512) ?? null,
      valor_estimado: Number.isFinite(valor) && valor > 0 ? valor : null,
      items: Array.isArray(cuerpo.items) ? cuerpo.items.slice(0, 50) : null,
    });

    // Se registra en el log del servidor pero igual se responde 204: el usuario
    // ya está en WhatsApp y no hay nada que mostrarle.
    if (error) console.error("[atribucion] no se pudo registrar:", error.message);
  } catch (error) {
    console.error("[atribucion] cuerpo inválido:", error);
  }

  return sinContenido();
};
