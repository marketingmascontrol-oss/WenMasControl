-- Permite marcar productos como "en promoción" desde el admin, para la
-- sección/página pública de Promociones (no existía en la plantilla de Excel
-- original, así que no depende de ella).
alter table productos add column if not exists en_promocion boolean not null default false;

create index if not exists idx_productos_en_promocion on productos (en_promocion) where en_promocion;
