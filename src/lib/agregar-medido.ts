import { agregarAlCarrito, type ItemCarrito } from "../stores/carrito";
import { reportarAgregadoAlCarrito } from "./medicion";
import { EVENTOS, empujar } from "./capa-datos";
import { agregarAlCarrito as agregarMeta } from "./meta";

// La única puerta de entrada al carrito desde el sitio. Agregar y medir van
// juntos acá para que ninguna superficie (botón de la ficha, modal de variante,
// pedido por tallas) pueda meter algo al carrito sin que Ads, GTM y Meta se
// enteren. Antes vivía inline en el oyente delegado de BaseLayout; al aparecer
// el pedido por tallas hubo una segunda superficie y se sacó a este módulo.
export function agregarYMedir(item: Omit<ItemCarrito, "cantidad">, cantidad: number, origen: string): void {
  agregarAlCarrito(item, cantidad);
  reportarAgregadoAlCarrito({ sku: item.sku, precio: item.precio, cantidad }, origen);
  empujar(EVENTOS.agregarCarrito, {
    value: item.precio * cantidad,
    items: [{ item_id: item.sku, item_name: item.nombre, price: item.precio, quantity: cantidad }],
  });
  agregarMeta({ sku: item.sku, precio: item.precio, cantidad });
}
