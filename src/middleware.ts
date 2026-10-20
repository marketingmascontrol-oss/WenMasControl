import { defineMiddleware } from "astro:middleware";
import { obtenerUsuarioAdmin } from "./lib/admin-auth";
import { SITE } from "./lib/site";
import {
  COOKIE_ATRIBUCION,
  COOKIE_REF,
  DIAS_ATRIBUCION,
  deserializarAtribucion,
  extraerParamsCampana,
  fuenteDeParams,
  conFuente,
  generarCodigoRefSeguro,
  serializarAtribucion,
  tieneClicPago,
} from "./lib/atribucion";

const RUTA_LOGIN = "/admin/iniciar-sesion";

// Los dominios que ya no son el principal. Todo lo que llegue por acá se manda
// al de SITE.url con un 301.
//
// POR QUÉ 301 Y NO SÓLO EL CANÓNICO. El canónico es una sugerencia: le dice al
// buscador cuál preferir, pero deja las dos direcciones vivas y respondiendo, y
// la autoridad tarda meses en moverse —si se mueve—. El 301 dice «esto se mudó,
// para siempre», que es lo único que transfiere el posicionamiento de verdad y
// deja una sola dirección circulando por enlaces, correos y WhatsApp.
//
// Se conserva la ruta y la query: quien tenga guardado el enlace de un producto
// aterriza en ESE producto, no en la home. Un 301 a la portada es la forma más
// común de perder lo que se quería conservar.
const DOMINIOS_VIEJOS = new Set<string>(SITE.dominiosViejos);

const OPCIONES_COOKIE = {
  path: "/",
  maxAge: DIAS_ATRIBUCION * 24 * 60 * 60,
  sameSite: "lax" as const,
  secure: true,
  // Deliberadamente NO httpOnly: whatsapp.ts tiene que leer el código desde el
  // navegador para pegarlo en el mensaje. No hay nada sensible acá, sólo
  // identificadores de campaña que ya venían en la URL pública.
  httpOnly: false,
  // serializarAtribucion ya codifica el JSON. Sin esto Astro codifica encima y
  // la cookie ocupa el doble, que con UTM largos se acerca al límite de ~4 KB a
  // partir del cual el navegador la descarta entera.
  encode: (valor: string) => valor,
};

/**
 * Guarda de qué campaña viene esta visita.
 *
 * 🔴 POR QUÉ ACÁ Y NO EN EL CLIENTE. El gclid llega en la URL de aterrizaje y
 * se pierde en el primer clic interno. Capturarlo en el servidor, antes de
 * pintar nada, es lo único que garantiza que sobreviva hasta el momento —quizá
 * tres páginas después— en que la persona toca «Hablar con un asesor».
 *
 * Criterio de última interacción para el clic pago: si alguien llega hoy por
 * Meta habiendo llegado la semana pasada por Google, la conversación de hoy es
 * de Meta. Una visita orgánica NO pisa la atribución previa — por eso
 * extraerParamsCampana devuelve null cuando no hay ningún parámetro.
 */
function registrarAtribucion(context: Parameters<Parameters<typeof defineMiddleware>[0]>[0]) {
  const params = extraerParamsCampana(context.url);

  if (params) {
    const previa = deserializarAtribucion(context.cookies.get(COOKIE_ATRIBUCION)?.value);

    // Una visita con UTM pero sin identificador de clic —un enlace en un correo,
    // por ejemplo— no debería borrar un gclid pago capturado antes: se fusiona
    // encima en vez de reemplazar.
    const fusionados =
      previa && !tieneClicPago(params) ? { ...previa.params, ...params } : params;

    context.cookies.set(
      COOKIE_ATRIBUCION,
      serializarAtribucion({
        params: fusionados,
        landing: context.url.pathname,
        referrer: context.request.headers.get("referer")?.slice(0, 256) ?? undefined,
        ts: new Date().toISOString(),
      }),
      OPCIONES_COOKIE,
    );
  }

  // El código lleva la letra del origen (MC-G-7K2M = Google), para que el asesor
  // sepa de dónde viene la persona con solo leer el chat.
  //
  // El sufijo se emite una sola vez y NO cambia nunca: es la llave que une
  // todas las visitas de esa persona y la que después cruza la venta cerrada.
  // La letra sí se actualiza si cambia la campaña de origen, porque la
  // atribución de pago es de última interacción.
  const atribucionVigente = deserializarAtribucion(context.cookies.get(COOKIE_ATRIBUCION)?.value);
  const fuente = fuenteDeParams(atribucionVigente?.params);
  const codigoActual = context.cookies.get(COOKIE_REF)?.value;
  const codigoNuevo = codigoActual
    ? conFuente(codigoActual, fuente)
    : generarCodigoRefSeguro(fuente);

  if (codigoNuevo !== codigoActual) {
    context.cookies.set(COOKIE_REF, codigoNuevo, OPCIONES_COOKIE);
  }
}

// Protege /admin/** por UX (redirige a login sin sesión). No es la única
// barrera: las Astro Actions se validan aparte con requerirAdmin(), porque no
// viven bajo /admin y esta ruta no las cubre.
export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;

  // Vercel reenvía el dominio que tipeó la persona en X-Forwarded-Host; el host
  // de context.url es el interno del runtime y no sirve para decidir esto.
  const hostPublico = (
    context.request.headers.get("x-forwarded-host") ??
    context.request.headers.get("host") ??
    ""
  ).split(":")[0].toLowerCase();

  if (DOMINIOS_VIEJOS.has(hostPublico)) {
    const destino = new URL(context.url.pathname + context.url.search, SITE.url);
    return context.redirect(destino.toString(), 301);
  }

  // Después del 301 —no antes—: en el dominio viejo la respuesta es una
  // redirección y la cookie se perdería. Se excluyen el panel, los endpoints de
  // datos y los feeds: no son aterrizajes de campaña y los feeds los consume un
  // robot sin cookies.
  if (
    !pathname.startsWith("/admin") &&
    !pathname.startsWith("/api") &&
    !pathname.startsWith("/feed")
  ) {
    registrarAtribucion(context);
  }

  if (pathname.startsWith("/admin") && pathname !== RUTA_LOGIN) {
    const usuario = await obtenerUsuarioAdmin(context);
    if (!usuario) {
      return context.redirect(RUTA_LOGIN);
    }
    context.locals.usuarioAdmin = usuario;
  }

  return next();
});
