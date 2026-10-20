-- Marca del producto (3M, Croydon, Portwest, Steelpro, Libus, …).
--
-- Hasta ahora no existía, y es un campo obligatorio del feed de Google Merchant
-- Center y muy recomendado en el catálogo de Meta: sin él los productos se
-- rechazan o rinden mucho peor. En EPP la marca además es señal de compra —
-- el comprador busca "botas Croydon", no "botas".
alter table productos add column if not exists marca text;

-- Los anuncios de Shopping se segmentan por marca: conviene tenerlo indexado.
create index if not exists idx_productos_marca on productos (marca) where marca is not null;
