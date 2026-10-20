// Tipos de dominio para el catálogo EPP/Dotación (Supabase <-> Astro)

export interface Categoria {
  id: string;
  nombre: string;
  slug: string;
  imagen_url: string | null;
  activa: boolean;
  orden: number;
}

export interface ProductoImagen {
  id: string;
  producto_id: string;
  url: string;
  alt: string | null;
  orden: number;
  es_principal: boolean;
}

// Combinación talla+color con su propio stock. Todo producto tiene al menos
// una variante (si no aplica talla/color real, el admin carga una sola fila,
// ej. talla "Única"). producto.stock es la suma de estas — ver trigger en
// supabase/schema.sql.
export interface ProductoVariante {
  id: string;
  producto_id: string;
  talla: string;
  color: string;
  stock: number;
  orden: number;
}

export interface Producto {
  id: string;
  sku: string;
  nombre: string;
  slug: string;
  precio: number;
  stock: number;
  categoria_id: string | null;
  descripcion_corta: string | null;
  descripcion_larga: string | null;
  sub_categoria: string | null;
  /** Marca del fabricante (3M, Croydon, Portwest…). Obligatoria en el feed de Merchant Center. */
  marca: string | null;
  activo: boolean;
  en_promocion: boolean;
  destacado: boolean;
  created_at: string;
  updated_at: string;
}

export interface Resena {
  id: string;
  producto_id: string;
  autor_nombre: string;
  calificacion: number;
  comentario: string | null;
  aprobada: boolean;
  created_at: string;
}

export interface ResumenResenas {
  promedio: number;
  total: number;
}

// Forma "enriquecida" que usarán las páginas de Astro (listados, PDP, /api/search)
export interface ProductoConRelaciones extends Producto {
  categoria: Categoria | null;
  imagenes: ProductoImagen[];
  variantes: ProductoVariante[];
}

// Fila cruda tal como llega desde "Plantilla Productos .xlsx"
export interface ExcelProductoRow {
  SKU: string;
  Nombre_Producto: string;
  Precio: number;
  Stock: number;
  Categoria: string;
  "Sub-Categoria": string;
  Descripcion_Corta: string;
  Descripcion_Larga: string;
  // Nombres de archivo de imagen separados por coma o pipe, ej: "guante-1.jpg|guante-2.jpg"
  Imagenes_Galeria: string;
}

// Resultado de validar una fila del Excel antes de insertarla
export interface FilaValidada {
  fila: number; // número de fila en el Excel, para reportar errores al usuario
  ok: boolean;
  errores: string[];
  data?: ExcelProductoRow;
}
