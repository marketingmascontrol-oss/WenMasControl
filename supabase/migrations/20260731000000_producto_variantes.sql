-- Variantes de producto (talla + color), con stock independiente por
-- combinación. Todo producto tiene al menos una variante (si no aplica
-- talla/color real, el admin carga una única fila, ej. "Talla: Única").
--
-- productos.stock pasa a ser un agregado derivado (suma de las variantes),
-- mantenido por trigger, para no romper los lugares que ya leen
-- producto.stock (ProductCard, BuyBox, ProductSchema, estadoStock, admin).
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

create index if not exists idx_producto_variantes_producto on producto_variantes (producto_id);

alter table producto_variantes enable row level security;

create policy "lectura publica variantes"
  on producto_variantes for select using (true);

-- Sin policies de insert/update/delete: mismo patrón que productos, solo
-- service_role (admin) escribe.

drop trigger if exists trg_producto_variantes_updated_at on producto_variantes;
create trigger trg_producto_variantes_updated_at
before update on producto_variantes
for each row execute function set_updated_at();

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
