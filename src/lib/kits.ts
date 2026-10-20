import { supabase } from "./supabase";
import type { ProductoConRelaciones } from "../../types/product";

// Kits de dotación por oficio, para el armador del hero.
//
// El comprador de EPP no llega buscando «guante de vaqueta reforzado»: llega
// con una cuadrilla de obra o un turno de soldadura que dotar. El kit le pone
// delante lo que ese oficio necesita, con el precio por trabajador, y lo manda
// a cotizar por WhatsApp con el número de personas.
//
// Se definen por SKU porque el SKU es lo estable del catálogo (es también el
// `content_id` de Meta). La visibilidad la sigue mandando la Vitrina: la
// consulta va con la anon key, así que un producto oculto —o de una categoría
// apagada— no vuelve, y el kit se muestra sin él. Un kit con menos de tres
// productos visibles no se muestra.
//
// ⚠️ El catálogo heredado no tiene arnés de cuerpo completo: el kit de alturas
// queda con casco, barbuquejo, eslinga y mosquetón hasta que se cargue uno.
export interface DefinicionKit {
  id: string;
  oficio: string;
  descripcion: string;
  skus: string[];
}

export const KITS: DefinicionKit[] = [
  {
    id: "obra",
    oficio: "Construcción",
    descripcion: "Obra civil, mampostería y acabados.",
    skus: ["0996-CASIMT1-WI1", "1027-BOCON-WI1", "1148-GUIVRVC-WI1", "1122-GAFANESL/C-WI1", "1209-CHMASREFLE-WI1", "1111-PRAU4M-WI1"],
  },
  {
    id: "alturas",
    oficio: "Alturas",
    descripcion: "Trabajo en andamios, techos y torres.",
    skus: ["0994-CASALT2-WI1", "0992-BMN3AP-WI1", "0974-ESLY32R-WI1", "0970-MOS45KN-WI1", "1178-GNi38 -WI1", "1029-BOTMAN-WI1"],
  },
  {
    id: "planta",
    oficio: "Industria",
    descripcion: "Plantas, bodegas y líneas de producción.",
    skus: ["0331-OVDP-WI1", "1042-BOWS-WI1", "HSI29N5MA", "1125B-MZ", "1114-PROAUDAM-WI1", "1234B MASCVAL95"],
  },
  {
    id: "soldadura",
    oficio: "Soldadura",
    descripcion: "Soldadura, corte y esmerilado.",
    skus: ["1115-CARMVC-WI1", "HSI50RBRKMA", "1151-PV60/90-WI1", "1163C-MAENKE", "1030-BOMSOL-WI1", "1155-CHENSVAQU-WI1"],
  },
  {
    id: "quimicos",
    oficio: "Químicos y aseo",
    descripcion: "Fumigación, limpieza industrial y laboratorios.",
    skus: ["1102-RP3M6200-WI1", "1088-CT3M6003-WI1", "1190-GUNNTVL-WI1", "BP81WDMA", "1041-BOWAL-WI1", "1120-GAFANFOGL/C-WI1"],
  },
  {
    id: "ley",
    oficio: "Dotación de ley",
    descripcion: "Calzado y vestido de labor para el personal.",
    skus: ["0061-CJA-WI1", "0001-PJA-WI1", "0241-CMP-WI1", "1029-BOTMAN-WI1", "0841-CACH-WI1"],
  },
];

export interface ItemKit {
  sku: string;
  nombre: string;
  slug: string;
  precio: number;
  imagen: string | null;
}

export interface Kit extends Omit<DefinicionKit, "skus"> {
  items: ItemKit[];
  precioPorTrabajador: number;
}

export async function obtenerKits(): Promise<Kit[]> {
  const todos = [...new Set(KITS.flatMap((k) => k.skus))];
  const { data, error } = await supabase
    .from("productos")
    .select("*, imagenes:producto_imagenes!inner(*)")
    .in("sku", todos);

  // El hero no puede caerse por un kit: sin datos, no hay armador y queda el resto.
  if (error) return [];

  const porSku = new Map<string, ItemKit>(
    ((data ?? []) as unknown as ProductoConRelaciones[]).map((p) => {
      const img = p.imagenes.find((i) => i.es_principal) ?? [...p.imagenes].sort((a, b) => a.orden - b.orden)[0];
      return [p.sku, { sku: p.sku, nombre: p.nombre, slug: p.slug, precio: p.precio, imagen: img?.url ?? null }];
    }),
  );

  return KITS.map(({ skus, ...kit }) => {
    const items = skus.map((s) => porSku.get(s)).filter((i): i is ItemKit => Boolean(i));
    return { ...kit, items, precioPorTrabajador: items.reduce((n, i) => n + i.precio, 0) };
  }).filter((k) => k.items.length >= 3);
}
