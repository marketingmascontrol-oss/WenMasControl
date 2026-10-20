-- Esquema Supabase (Postgres) para catálogo EPP / Dotación Industrial
-- Migración aplicada por `supabase start` / `supabase db reset`.
-- Fuente legible: supabase/schema.sql (mismo contenido, mantenido como referencia de la Fase 1).

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

-- Índices de soporte para navegación por categoría y para /api/search
create index if not exists idx_productos_categoria       on productos (categoria_id);
create index if not exists idx_productos_activo           on productos (activo);
create index if not exists idx_productos_nombre_trgm      on productos using gin (nombre gin_trgm_ops);
create index if not exists idx_productos_desc_corta_trgm  on productos using gin (descripcion_corta gin_trgm_ops);
create index if not exists idx_producto_imagenes_producto on producto_imagenes (producto_id);

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

-- Row Level Security: lectura pública de catálogo activo, escritura solo service_role
alter table categorias enable row level security;
alter table productos enable row level security;
alter table producto_imagenes enable row level security;

create policy "lectura publica categorias"
  on categorias for select using (true);

create policy "lectura publica productos activos"
  on productos for select using (activo = true);

create policy "lectura publica imagenes"
  on producto_imagenes for select using (true);

-- Nota: no se crean policies de insert/update/delete a propósito.
-- El import script y el futuro panel admin deben usar la service_role key,
-- que ignora RLS. Así el anon key (usado por Astro/Arkco360) queda 100% read-only.
