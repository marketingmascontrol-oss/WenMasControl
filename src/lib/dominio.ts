// Qué hosts pueden reportar a las plataformas de publicidad.
//
// Vive aparte de medicion.ts porque ahora lo necesitan dos módulos —Google Ads
// y Meta— y si meta.ts lo importara de medicion.ts, y medicion.ts importara
// meta.ts para el InitiateCheckout, quedaría un ciclo de importaciones.
//
// Sin esta guarda, cada `npm run dev` y cada preview de Vercel ensuciaría las
// cuentas reales con conversiones que no existieron. Una campaña optimizando
// contra datos inventados es peor que una sin medir.
//
// ⚠️ TODOS LOS DOMINIOS VIVOS van en SITE.dominios, también los que redirigen:
// un anuncio viejo puede apuntar ahí. Dejar afuera un dominio vivo es perder
// conversiones en silencio.
import { SITE } from "./site";

const DOMINIOS_REALES: readonly string[] = SITE.dominios;

export function debeMedir(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return DOMINIOS_REALES.some((d) => host === d || host.endsWith(`.${d}`));
}
