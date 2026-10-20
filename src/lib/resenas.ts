import { supabase } from "./supabase";
import type { Resena, ResumenResenas } from "../../types/product";

export async function obtenerResenasAprobadas(productoId: string): Promise<Resena[]> {
  const { data, error } = await supabase
    .from("resenas")
    .select("*")
    .eq("producto_id", productoId)
    .eq("aprobada", true)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Error consultando reseñas: ${error.message}`);
  return data ?? [];
}

function calcularResumen(calificaciones: number[]): ResumenResenas {
  if (calificaciones.length === 0) return { promedio: 0, total: 0 };
  const suma = calificaciones.reduce((acc, c) => acc + c, 0);
  return { promedio: suma / calificaciones.length, total: calificaciones.length };
}

// Una sola consulta para N productos (tarjetas de un grid), en vez de N+1.
export async function obtenerResumenResenasPorProductos(
  productoIds: string[]
): Promise<Map<string, ResumenResenas>> {
  const mapa = new Map<string, ResumenResenas>();
  if (productoIds.length === 0) return mapa;

  const { data, error } = await supabase
    .from("resenas")
    .select("producto_id, calificacion")
    .eq("aprobada", true)
    .in("producto_id", productoIds);

  if (error) throw new Error(`Error consultando resumen de reseñas: ${error.message}`);

  const porProducto = new Map<string, number[]>();
  for (const fila of data ?? []) {
    const lista = porProducto.get(fila.producto_id) ?? [];
    lista.push(fila.calificacion);
    porProducto.set(fila.producto_id, lista);
  }
  for (const [productoId, calificaciones] of porProducto) {
    mapa.set(productoId, calcularResumen(calificaciones));
  }
  return mapa;
}

export async function obtenerResumenResenas(productoId: string): Promise<ResumenResenas> {
  const mapa = await obtenerResumenResenasPorProductos([productoId]);
  return mapa.get(productoId) ?? { promedio: 0, total: 0 };
}
