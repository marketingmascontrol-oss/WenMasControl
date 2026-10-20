-- La vitrina: qué muestra +Control y qué no.
--
-- POR QUÉ. +Control arranca con el mismo catálogo de Wincol (copiado una vez
-- con scripts/copiar-catalogo-wincol.ts), pero no vende todo lo que vende
-- Wincol, y lo que vende cambia según el cliente. El panel tiene que poder
-- prender y apagar productos y categorías enteras sin borrar nada.
--
-- ⚖️ LA REGLA VIVE EN LA POLÍTICA, NO EN LAS CONSULTAS. Todo lo público —las
-- páginas, los feeds de Google y Meta, /api/search y /api/producto/[sku] que
-- consulta Arkco360— lee con la anon key. Si la visibilidad se filtrara
-- consulta por consulta, bastaría olvidar un `.eq()` para que un producto
-- apagado siguiera en el feed de Merchant Center o en las respuestas del bot.
-- Acá se apaga una vez y desaparece de todos lados.

-- Categoría apagada = desaparece del menú y se llevan sus productos.
alter table categorias add column if not exists activa boolean not null default true;
-- Orden de la fila de categorías del header y del mosaico de la home.
alter table categorias add column if not exists orden integer not null default 0;

-- Lo que el cliente elige para la home. Sin ninguno marcado, la home sigue
-- mostrando una selección al azar, como hasta ahora.
alter table productos add column if not exists destacado boolean not null default false;
create index if not exists idx_productos_destacado on productos (destacado) where destacado;

drop policy if exists "lectura publica categorias" on categorias;
create policy "lectura publica categorias activas"
  on categorias for select using (activa = true);

drop policy if exists "lectura publica productos activos" on productos;
create policy "lectura publica productos visibles"
  on productos for select using (
    activo = true
    and (
      categoria_id is null
      or exists (select 1 from categorias c where c.id = categoria_id and c.activa = true)
    )
  );
