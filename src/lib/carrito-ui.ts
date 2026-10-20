import { quitarDelCarrito, actualizarCantidadCarrito, type ItemCarrito } from "../stores/carrito";
import { formatearPrecio } from "./formato";

// Fila de un ítem del carrito, compartida entre el drawer (BaseLayout) y la
// página /carrito de respaldo — un solo lugar de verdad para el markup + eventos.
export function crearFilaCarrito(item: ItemCarrito): HTMLElement {
  const fila = document.createElement("div");
  fila.className = "flex items-center gap-3 rounded-lg border border-slate-200 p-3";

  const miniatura = document.createElement("div");
  miniatura.className =
    "flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md border border-slate-100 bg-white";
  if (item.imagen) {
    const img = document.createElement("img");
    img.src = item.imagen;
    img.alt = item.nombre;
    img.className = "h-full w-full object-contain";
    miniatura.appendChild(img);
  }

  const info = document.createElement("div");
  info.className = "min-w-0 flex-1";
  const nombreEl = document.createElement("p");
  nombreEl.className = "truncate text-sm font-medium text-slate-900";
  nombreEl.textContent = item.nombre;
  const varianteEl = document.createElement("p");
  varianteEl.className = "mt-0.5 text-xs text-slate-500";
  varianteEl.textContent = `Talla: ${item.talla} · Color: ${item.color}`;
  const precioUnitEl = document.createElement("p");
  precioUnitEl.className = "mt-0.5 text-xs text-slate-500";
  precioUnitEl.textContent = formatearPrecio(item.precio);
  info.append(nombreEl, varianteEl, precioUnitEl);

  const controles = document.createElement("div");
  controles.className = "flex shrink-0 items-center rounded-md border border-slate-300";
  const botonRestar = document.createElement("button");
  botonRestar.type = "button";
  botonRestar.className = "px-2 py-1 text-slate-600 hover:text-slate-900";
  botonRestar.textContent = "−";
  botonRestar.setAttribute("aria-label", "Restar cantidad");
  botonRestar.addEventListener("click", () => actualizarCantidadCarrito(item.varianteId, item.cantidad - 1));
  const cantidadEl = document.createElement("span");
  cantidadEl.className = "w-6 text-center text-xs";
  cantidadEl.textContent = String(item.cantidad);
  const botonSumar = document.createElement("button");
  botonSumar.type = "button";
  botonSumar.className = "px-2 py-1 text-slate-600 hover:text-slate-900";
  botonSumar.textContent = "+";
  botonSumar.setAttribute("aria-label", "Sumar cantidad");
  botonSumar.addEventListener("click", () => actualizarCantidadCarrito(item.varianteId, item.cantidad + 1));
  controles.append(botonRestar, cantidadEl, botonSumar);

  const botonQuitar = document.createElement("button");
  botonQuitar.type = "button";
  botonQuitar.className = "shrink-0 text-slate-400 hover:text-red-600";
  botonQuitar.setAttribute("aria-label", "Quitar del carrito");
  botonQuitar.textContent = "✕";
  botonQuitar.addEventListener("click", () => quitarDelCarrito(item.varianteId));

  fila.append(miniatura, info, controles, botonQuitar);
  return fila;
}

export interface ProductoSugerido {
  sku: string;
  nombre: string;
  slug: string;
  precio: number;
  imagen: string | null;
}

// Tarjeta angosta de venta cruzada ("también te puede interesar"). Enlaza a
// la ficha del producto en vez de agregar directo: así se elige talla/color
// ahí, sin duplicar el selector de variantes acá.
export function crearTarjetaSugerida(producto: ProductoSugerido): HTMLElement {
  const tarjeta = document.createElement("a");
  tarjeta.href = `/productos/${producto.slug}`;
  tarjeta.className =
    "flex flex-col overflow-hidden rounded-md border border-slate-200 p-2 hover:border-slate-300";

  const miniatura = document.createElement("div");
  miniatura.className = "flex aspect-square items-center justify-center overflow-hidden rounded bg-white";
  if (producto.imagen) {
    const img = document.createElement("img");
    img.src = producto.imagen;
    img.alt = producto.nombre;
    img.loading = "lazy";
    img.className = "h-full w-full object-contain";
    miniatura.appendChild(img);
  }

  const nombreEl = document.createElement("p");
  nombreEl.className = "mt-1.5 line-clamp-2 text-xs text-slate-700";
  nombreEl.textContent = producto.nombre;

  const precioEl = document.createElement("p");
  precioEl.className = "mt-0.5 text-xs font-semibold text-slate-900";
  precioEl.textContent = formatearPrecio(producto.precio);

  tarjeta.append(miniatura, nombreEl, precioEl);
  return tarjeta;
}
