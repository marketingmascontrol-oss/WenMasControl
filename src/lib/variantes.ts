import type { ProductoVariante } from "../../types/product";

// Helpers puros compartidos entre el modal de selección de la grilla
// (SelectorVarianteModal) y los selectores inline de la ficha (BuyBox).

function unicos(valores: string[]): string[] {
  return [...new Set(valores)];
}

export function tallasDisponibles(variantes: readonly ProductoVariante[]): string[] {
  return unicos(variantes.map((v) => v.talla));
}

export function coloresDisponibles(variantes: readonly ProductoVariante[]): string[] {
  return unicos(variantes.map((v) => v.color));
}

// Colores con stock > 0 para una talla dada, para deshabilitar combinaciones
// agotadas en vez de dejarlas seleccionables sin stock (igual que Temu).
export function coloresParaTalla(variantes: readonly ProductoVariante[], talla: string): string[] {
  return unicos(variantes.filter((v) => v.talla === talla && v.stock > 0).map((v) => v.color));
}

export function buscarVariante(
  variantes: readonly ProductoVariante[],
  talla: string,
  color: string
): ProductoVariante | undefined {
  return variantes.find((v) => v.talla === talla && v.color === color);
}
