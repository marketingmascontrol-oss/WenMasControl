import { persistentAtom } from "@nanostores/persistent";

// Estado global del carrito. Vive en localStorage (persistentAtom) porque el sitio
// es SSG/multi-página, no una SPA: el carrito debe sobrevivir a la navegación entre
// páginas estáticas. Arkco360 (Fase 4) puede leer/escribir este mismo store — ver
// el bridge en window.MCCarrito más abajo, pensado para scripts que no comparten
// el mismo grafo de módulos ESM que el bundle de Astro.
export interface ItemCarrito {
  varianteId: string;
  sku: string;
  nombre: string;
  precio: number;
  cantidad: number;
  imagen?: string;
  talla: string;
  color: string;
}

export const $carrito = persistentAtom<ItemCarrito[]>("mc:carrito", [], {
  encode: JSON.stringify,
  decode: JSON.parse,
});

// La clave de línea es varianteId, no sku: el mismo producto puede estar en
// el carrito varias veces, una por cada combinación de talla/color elegida.
export function agregarAlCarrito(item: Omit<ItemCarrito, "cantidad">, cantidad = 1): void {
  const actual = $carrito.get();
  const existente = actual.find((i) => i.varianteId === item.varianteId);

  if (existente) {
    $carrito.set(
      actual.map((i) =>
        i.varianteId === item.varianteId ? { ...i, cantidad: i.cantidad + cantidad } : i
      )
    );
  } else {
    $carrito.set([...actual, { ...item, cantidad }]);
  }
}

export function quitarDelCarrito(varianteId: string): void {
  $carrito.set($carrito.get().filter((i) => i.varianteId !== varianteId));
}

export function actualizarCantidadCarrito(varianteId: string, cantidad: number): void {
  if (cantidad <= 0) {
    quitarDelCarrito(varianteId);
    return;
  }
  $carrito.set(
    $carrito.get().map((i) => (i.varianteId === varianteId ? { ...i, cantidad } : i))
  );
}

export function vaciarCarrito(): void {
  $carrito.set([]);
}

export function totalItemsCarrito(carrito: readonly ItemCarrito[]): number {
  return carrito.reduce((acc, i) => acc + i.cantidad, 0);
}

export function totalPrecioCarrito(carrito: readonly ItemCarrito[]): number {
  return carrito.reduce((acc, i) => acc + i.precio * i.cantidad, 0);
}
