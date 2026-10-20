-- Postulaciones de proveedores ("¿Querés ser proveedor? Trabajá con nosotros").
-- Mismo patrón que resenas: cualquiera puede enviar (vía Astro Action con
-- service_role), el admin las revisa y marca como contactadas desde el panel.
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

alter table solicitudes_proveedor enable row level security;

-- Sin policies: nadie lee/escribe directo con la anon key. El formulario
-- público inserta vía Astro Action con service_role (igual que resenas), y
-- el panel admin también consulta con service_role.
