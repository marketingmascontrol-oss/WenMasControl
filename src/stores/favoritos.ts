import { persistentAtom } from "@nanostores/persistent";

// Mismo patrón que el carrito (src/stores/carrito.ts): localStorage porque el
// sitio es multi-página, no una SPA. Guarda los datos necesarios para pintar
// la lista en /favoritos sin tener que volver a pedirlos al servidor.
export interface ItemFavorito {
  sku: string;
  slug: string;
  nombre: string;
  precio: number;
  imagen?: string;
}

export const $favoritos = persistentAtom<ItemFavorito[]>("mc:favoritos", [], {
  encode: JSON.stringify,
  decode: JSON.parse,
});

export function esFavorito(sku: string): boolean {
  return $favoritos.get().some((f) => f.sku === sku);
}

export function alternarFavorito(item: ItemFavorito): void {
  const actual = $favoritos.get();
  if (actual.some((f) => f.sku === item.sku)) {
    $favoritos.set(actual.filter((f) => f.sku !== item.sku));
  } else {
    $favoritos.set([...actual, item]);
  }
}
