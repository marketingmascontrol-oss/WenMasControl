/**
 * El buscador con el cerebro de Arkco.
 *
 * POR QUÉ. El buscador propio compara palabras, y la gente no busca con las
 * palabras del catálogo. Medido acá mismo el 07/08/2026:
 *
 *     «algo para proteger los oídos»  → guante soldador y casco  ← nada auditivo
 *     «guantes para soldar»           → guante de nitrilo        ← hay de carnaza
 *     «trabajo en alturas»            → nada
 *
 * Lo grave no es el vacío: devolver lo equivocado con seguridad hace que el
 * comprador concluya que no lo vendemos y se vaya. Arkco traduce la intención a
 * los términos del catálogo antes de buscar —oídos → protector auditivo, soldar
 * → carnaza, alturas → eslinga— y de paso sugiere lo que falta.
 *
 * SI ARKCO NO RESPONDE, SE BUSCA IGUAL. La tienda no puede quedarse sin buscador
 * porque un servicio externo esté caído o lento: hay un tiempo límite corto y,
 * pasado ése, se usa el buscador de siempre. Un resultado imperfecto llega antes
 * que ninguno.
 */

import { SITE } from "./site";

const ARKCO = SITE.arkco.api;
const TENANT = SITE.arkco.tenant;

// Medio segundo. Es un buscador con sugerencias mientras se escribe: más que
// eso se siente trabado, y el buscador propio responde al instante.
const LIMITE_MS = 1500;

export interface ProductoBuscado {
  sku: string;
  nombre: string;
  precio: number;
  stock?: number;
  /** `null` y no `undefined`: es el mismo contrato que usa el buscador propio,
   *  y así las sugerencias del encabezado no tienen que distinguir dos casos. */
  imagen: string | null;
  url?: string;
  /** Siempre presente: las sugerencias del encabezado enlazan por slug. */
  slug: string;
  categoria?: string | null;
}

export interface BusquedaArkco {
  productos: ProductoBuscado[];
  /** Lo que Arkco entendió («protección auditiva»). Vacío si buscó literal. */
  intencion: string;
  /** «Para que quede completo, normalmente se pide junto con…». Puede ir vacía. */
  asesoria: string;
  /** De dónde salió el resultado — sirve para saber si el cerebro actuó. */
  fuente: "arkco" | "tienda";
}

/** Convierte la respuesta del buscador propio al mismo formato. */
function desdeLaTienda(datos: { resultados?: ProductoBuscado[] }): BusquedaArkco {
  return {
    productos: datos.resultados ?? [],
    intencion: "",
    asesoria:  "",
    fuente:    "tienda",
  };
}

/** «…/productos/casco-insafe» → «casco-insafe». Arkco devuelve la URL completa. */
function slugDesdeUrl(url: string | undefined): string {
  return (url ?? "").split("/").filter(Boolean).pop() ?? "";
}

export async function buscar(q: string, signal?: AbortSignal): Promise<BusquedaArkco> {
  const consulta = (q ?? "").trim();
  if (!consulta) return { productos: [], intencion: "", asesoria: "", fuente: "tienda" };

  // Reloj propio: si Arkco tarda, no se espera. `signal` sigue mandando —es el
  // que cancela la búsqueda anterior cuando el usuario sigue escribiendo.
  const reloj = new AbortController();
  const corte = setTimeout(() => reloj.abort(), LIMITE_MS);
  signal?.addEventListener("abort", () => reloj.abort(), { once: true });

  try {
    const url = `${ARKCO}/tienda/buscar?tenant_slug=${TENANT}&q=${encodeURIComponent(consulta)}&limit=12`;
    const res = await fetch(url, { signal: reloj.signal });
    if (res.ok) {
      const d = await res.json();
      // Si Arkco no encontró nada, no se da por vencido: el buscador propio
      // todavía puede acertar con las palabras exactas del cliente.
      if ((d.productos ?? []).length > 0) {
        return {
          // El slug sale de la URL: el encabezado enlaza por slug y Arkco
          // devuelve la dirección completa de la ficha.
          productos: (d.productos as ProductoBuscado[]).map((p) => ({
            ...p,
            slug:   p.slug || slugDesdeUrl(p.url),
            imagen: p.imagen ?? null,
          })),
          intencion: d.intencion ?? "",
          asesoria:  d.asesoria ?? "",
          fuente:    "arkco",
        };
      }
    }
  } catch {
    // Caído, lento o cancelado: se sigue de largo al buscador propio.
  } finally {
    clearTimeout(corte);
  }

  const res = await fetch(`/api/search?q=${encodeURIComponent(consulta)}&limite=12`, { signal });
  return desdeLaTienda(await res.json());
}
