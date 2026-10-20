// Umbral de "stock bajo" para avisos visuales en el admin. Un solo lugar de
// verdad: lo usan la lista de productos, el formulario y el nav del admin.
export const STOCK_BAJO_UMBRAL = 5;

export type EstadoStock = "agotado" | "bajo" | "ok";

export function estadoStock(stock: number): EstadoStock {
  if (stock <= 0) return "agotado";
  if (stock <= STOCK_BAJO_UMBRAL) return "bajo";
  return "ok";
}
