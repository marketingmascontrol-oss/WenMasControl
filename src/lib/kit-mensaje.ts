// Separado de kits.ts porque corre también en el navegador (el hero lo rearma
// al cambiar el número de trabajadores) y kits.ts trae el cliente de Supabase.
export interface KitParaMensaje {
  oficio: string;
  items: { nombre: string; sku: string }[];
}

/** El mensaje de WhatsApp del kit. Las líneas usan «SKU:», como el pedido del carrito. */
export function mensajeKit(kit: KitParaMensaje, trabajadores: number): string {
  return [
    `¡Hola! Quiero cotizar el kit de dotación para ${kit.oficio}, para ${trabajadores} ${trabajadores === 1 ? "trabajador" : "trabajadores"}:`,
    "",
    ...kit.items.map((i) => `• ${i.nombre} (SKU: ${i.sku})`),
    "",
    "¿Me ayudan con las tallas y el precio por volumen?",
  ].join("\n");
}
