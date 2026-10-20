-- Reseñas de producto, con moderación: cualquiera puede dejar una reseña
-- (queda pendiente), pero solo se muestran públicamente las aprobadas por el
-- admin. El admin también puede cargar reseñas propias (ej. demo/muestra
-- social) directamente aprobadas.
create table if not exists resenas (
  id uuid primary key default gen_random_uuid(),
  producto_id uuid not null references productos(id) on delete cascade,
  autor_nombre text not null,
  calificacion smallint not null check (calificacion between 1 and 5),
  comentario text,
  aprobada boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_resenas_producto on resenas (producto_id);
create index if not exists idx_resenas_pendientes on resenas (created_at) where not aprobada;

alter table resenas enable row level security;

create policy "lectura publica resenas aprobadas"
  on resenas for select using (aprobada = true);

-- Sin policies de insert/update/delete para anon/authenticated: la creación
-- pública y la moderación pasan por Astro Actions con service_role.
