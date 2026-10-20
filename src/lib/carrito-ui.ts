import { quitarDelCarrito, actualizarCantidadCarrito, type ItemCarrito } from "../stores/carrito";
import { formatearPrecio } from "./formato";

// Piezas del pedido, compartidas entre el panel lateral (CarritoDrawer) y la
// página /carrito de respaldo — un solo lugar de verdad para el markup + eventos.

export interface GrupoPedido {
  sku: string;
  nombre: string;
  imagen?: string;
  precio: number;
  lineas: ItemCarrito[];
}

// El carrito guarda una línea por variante (talla + color). En pantalla se
// agrupan por producto: «Bota Argyll — 37 ×2 · 40 ×2» se lee como el pedido
// que es, no como dos botas distintas. Es el espejo del pedido por tallas de
// la ficha.
export function agruparPorProducto(carrito: readonly ItemCarrito[]): GrupoPedido[] {
  const grupos = new Map<string, GrupoPedido>();
  for (const item of carrito) {
    const g = grupos.get(item.sku) ?? { sku: item.sku, nombre: item.nombre, imagen: item.imagen, precio: item.precio, lineas: [] };
    g.lineas.push(item);
    grupos.set(item.sku, g);
  }
  return [...grupos.values()];
}

function esUnica(valor: string): boolean {
  return /^[uú]nic[ao]$/i.test(valor);
}

/** «Talla 40 · Negro», «Talla 40», «Negro» o «Unidades», según lo que aplique. */
export function rotuloVariante(item: Pick<ItemCarrito, "talla" | "color">): string {
  const partes = [esUnica(item.talla) ? "" : `Talla ${item.talla}`, esUnica(item.color) ? "" : item.color].filter(Boolean);
  return partes.join(" · ") || "Unidades";
}

function botonCantidad(texto: string, etiqueta: string, alHacerClic: () => void): HTMLButtonElement {
  const boton = document.createElement("button");
  boton.type = "button";
  boton.className = "h-8 w-8 text-base text-acero hover:text-brand-500";
  boton.textContent = texto;
  boton.setAttribute("aria-label", etiqueta);
  boton.addEventListener("click", alHacerClic);
  return boton;
}

export function crearGrupoPedido(grupo: GrupoPedido): HTMLElement {
  const unidades = grupo.lineas.reduce((n, i) => n + i.cantidad, 0);

  const bloque = document.createElement("article");
  bloque.className = "py-4";

  const cabecera = document.createElement("div");
  cabecera.className = "flex gap-3";

  const miniatura = document.createElement("div");
  miniatura.className = "flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-[6px] bg-tecnico p-1.5";
  if (grupo.imagen) {
    const img = document.createElement("img");
    img.src = grupo.imagen;
    img.alt = "";
    img.className = "h-full w-full object-contain mix-blend-multiply";
    miniatura.appendChild(img);
  }

  const info = document.createElement("div");
  info.className = "min-w-0 flex-1";
  const nombreEl = document.createElement("p");
  nombreEl.className = "line-clamp-2 text-sm font-bold leading-snug text-brand-500";
  nombreEl.textContent = grupo.nombre;
  const refEl = document.createElement("p");
  refEl.className = "mt-0.5 text-[12px] font-semibold tabular-nums text-acero";
  refEl.textContent = `Ref. ${grupo.sku} · ${formatearPrecio(grupo.precio)} c/u`;
  info.append(nombreEl, refEl);

  const subtotalEl = document.createElement("p");
  subtotalEl.className = "shrink-0 text-right text-sm font-black tabular-nums text-brand-500";
  subtotalEl.textContent = formatearPrecio(grupo.precio * unidades);
  const unidadesEl = document.createElement("span");
  unidadesEl.className = "block text-[11px] font-semibold text-acero";
  unidadesEl.textContent = `${unidades} ${unidades === 1 ? "unidad" : "unidades"}`;
  subtotalEl.appendChild(unidadesEl);

  cabecera.append(miniatura, info, subtotalEl);

  const lista = document.createElement("ul");
  lista.className = "mt-3 divide-y divide-linea rounded-[6px] border border-linea";
  for (const item of grupo.lineas) {
    const fila = document.createElement("li");
    fila.className = "flex items-center gap-2 py-1 pl-3 pr-1";

    const rotulo = document.createElement("span");
    rotulo.className = "min-w-0 flex-1 truncate text-[13px] font-semibold text-brand-500";
    rotulo.textContent = rotuloVariante(item);

    const controles = document.createElement("span");
    controles.className = "flex items-center";
    const cantidadEl = document.createElement("span");
    cantidadEl.className = "w-7 text-center text-sm font-bold tabular-nums text-brand-500";
    cantidadEl.textContent = String(item.cantidad);
    controles.append(
      botonCantidad("−", `Una menos de ${rotuloVariante(item)}`, () => actualizarCantidadCarrito(item.varianteId, item.cantidad - 1)),
      cantidadEl,
      botonCantidad("+", `Una más de ${rotuloVariante(item)}`, () => actualizarCantidadCarrito(item.varianteId, item.cantidad + 1)),
    );

    const quitar = document.createElement("button");
    quitar.type = "button";
    quitar.className = "flex h-8 w-8 items-center justify-center text-acero hover:text-senal";
    quitar.setAttribute("aria-label", `Quitar ${rotuloVariante(item)} del pedido`);
    quitar.textContent = "✕";
    quitar.addEventListener("click", () => quitarDelCarrito(item.varianteId));

    fila.append(rotulo, controles, quitar);
    lista.appendChild(fila);
  }

  bloque.append(cabecera, lista);
  return bloque;
}

export interface ProductoSugerido {
  sku: string;
  nombre: string;
  slug: string;
  precio: number;
  imagen: string | null;
}

// Tarjeta angosta de venta cruzada («suele pedirse junto»). Enlaza a la ficha
// del producto en vez de agregar directo: así se elige talla/color ahí, sin
// duplicar el selector de variantes acá.
export function crearTarjetaSugerida(producto: ProductoSugerido): HTMLElement {
  const tarjeta = document.createElement("a");
  tarjeta.href = `/productos/${producto.slug}`;
  tarjeta.className = "group flex w-36 shrink-0 flex-col";

  const miniatura = document.createElement("div");
  miniatura.className = "flex aspect-square items-center justify-center overflow-hidden rounded-[6px] bg-tecnico p-2";
  if (producto.imagen) {
    const img = document.createElement("img");
    img.src = producto.imagen;
    img.alt = producto.nombre;
    img.loading = "lazy";
    img.className = "h-full w-full object-contain mix-blend-multiply transition group-hover:scale-105";
    miniatura.appendChild(img);
  }

  const nombreEl = document.createElement("p");
  nombreEl.className = "mt-1.5 line-clamp-2 text-xs font-semibold text-brand-500";
  nombreEl.textContent = producto.nombre;

  const precioEl = document.createElement("p");
  precioEl.className = "mt-0.5 text-xs font-black tabular-nums text-brand-500";
  precioEl.textContent = formatearPrecio(producto.precio);

  tarjeta.append(miniatura, nombreEl, precioEl);
  return tarjeta;
}
