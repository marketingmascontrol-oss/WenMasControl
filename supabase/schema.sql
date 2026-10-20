-- Esquema Supabase (Postgres) para catálogo EPP / Dotación Industrial
-- Fase 1: estructura de datos base. RLS pensado para lectura pública (anon)
-- desde los endpoints de Astro/Arkco360, y escritura solo vía service_role
-- (el script de importación y el futuro panel admin).
--
-- Este archivo es la referencia legible. Lo que realmente se ejecuta con
-- `supabase start` / `supabase db reset` es la copia versionada como migración
-- en supabase/migrations/20260101000000_esquema_inicial.sql (mismo contenido).

create extension if not exists pg_trgm;
create extension if not exists pgcrypto; -- gen_random_uuid()

create table if not exists categorias (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null unique,
  slug        text not null unique,
  created_at  timestamptz not null default now()
);

create table if not exists productos (
  id                  uuid primary key default gen_random_uuid(),
  sku                 text not null unique,
  nombre              text not null,
  slug                text not null unique,
  precio              numeric(12,2) not null check (precio >= 0),
  stock               integer not null default 0 check (stock >= 0),
  categoria_id        uuid references categorias(id) on delete set null,
  descripcion_corta   text,
  descripcion_larga   text,
  sub_categoria       text, -- referencia libre (ej. "GUANTE"), no usada aún en el sitio
  activo              boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table if not exists producto_imagenes (
  id            uuid primary key default gen_random_uuid(),
  producto_id   uuid not null references productos(id) on delete cascade,
  url           text not null,
  alt           text,
  orden         integer not null default 0,
  es_principal  boolean not null default false
);

-- Variantes de producto (talla + color), con stock independiente por
-- combinación. Todo producto tiene al menos una variante (si no aplica
-- talla/color real, el admin carga una única fila, ej. "Talla: Única").
-- productos.stock pasa a ser un agregado derivado (suma de variantes),
-- mantenido por trigger — ver más abajo.
create table if not exists producto_variantes (
  id            uuid primary key default gen_random_uuid(),
  producto_id   uuid not null references productos(id) on delete cascade,
  talla         text not null,
  color         text not null,
  stock         integer not null default 0 check (stock >= 0),
  orden         integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (producto_id, talla, color)
);

-- Índices de soporte para navegación por categoría y para /api/search
create index if not exists idx_productos_categoria       on productos (categoria_id);
create index if not exists idx_productos_activo           on productos (activo);
create index if not exists idx_productos_nombre_trgm      on productos using gin (nombre gin_trgm_ops);
create index if not exists idx_productos_desc_corta_trgm  on productos using gin (descripcion_corta gin_trgm_ops);
create index if not exists idx_producto_imagenes_producto on producto_imagenes (producto_id);
create index if not exists idx_producto_variantes_producto on producto_variantes (producto_id);

-- updated_at automático
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_productos_updated_at on productos;
create trigger trg_productos_updated_at
before update on productos
for each row execute function set_updated_at();

drop trigger if exists trg_producto_variantes_updated_at on producto_variantes;
create trigger trg_producto_variantes_updated_at
before update on producto_variantes
for each row execute function set_updated_at();

-- productos.stock = suma del stock de sus variantes, recalculado automáticamente
-- cada vez que una variante cambia (así ProductCard, BuyBox, ProductSchema y el
-- admin siguen leyendo producto.stock sin saber que ahora es un agregado).
create or replace function recalcular_stock_producto()
returns trigger as $$
declare
  pid uuid := coalesce(new.producto_id, old.producto_id);
begin
  update productos set stock = (
    select coalesce(sum(stock), 0) from producto_variantes where producto_id = pid
  ) where id = pid;
  return null;
end;
$$ language plpgsql;

drop trigger if exists trg_variantes_recalcular_stock on producto_variantes;
create trigger trg_variantes_recalcular_stock
after insert or update or delete on producto_variantes
for each row execute function recalcular_stock_producto();

-- Postulaciones de proveedores ("¿Querés ser proveedor? Trabajá con nosotros").
-- Sin policies: todo pasa por Astro Actions con service_role (ver
-- supabase/migrations/20260801010000_solicitudes_proveedor.sql).
create table if not exists solicitudes_proveedor (
  id                    uuid primary key default gen_random_uuid(),
  empresa               text not null,
  contacto_nombre       text not null,
  email                 text not null,
  telefono              text not null,
  categoria_productos   text not null,
  mensaje               text,
  contactado            boolean not null default false,
  created_at            timestamptz not null default now()
);

create index if not exists idx_solicitudes_proveedor_pendientes
  on solicitudes_proveedor (created_at) where not contactado;

-- Row Level Security: lectura pública de catálogo activo, escritura solo service_role
alter table categorias enable row level security;
alter table productos enable row level security;
alter table producto_imagenes enable row level security;
alter table producto_variantes enable row level security;
alter table solicitudes_proveedor enable row level security;

create policy "lectura publica categorias"
  on categorias for select using (true);

create policy "lectura publica productos activos"
  on productos for select using (activo = true);

create policy "lectura publica imagenes"
  on producto_imagenes for select using (true);

create policy "lectura publica variantes"
  on producto_variantes for select using (true);

-- Nota: no se crean policies de insert/update/delete a propósito.
-- El import script y el futuro panel admin deben usar la service_role key,
-- que ignora RLS. Así el anon key (usado por Astro/Arkco360) queda 100% read-only.
