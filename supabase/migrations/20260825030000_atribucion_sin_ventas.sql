-- Se quitan de `atribucion` las columnas para anotar ventas.
--
-- 🔴 POR QUÉ. CLAUDE.md, sección «LA FRONTERA»: el lead, la conversación y el
-- monto de la venta viven en la base de Arkco360, no en ésta. La pantalla que
-- las llenaba (/admin/ventas) se quitó de este repo por esa misma razón, y sin
-- ella estas columnas quedaron sin nadie que las escriba ni las lea.
--
-- Dejarlas vacías invita a que alguien las vuelva a llenar más adelante y se
-- recree la segunda fuente de verdad que se acaba de desarmar.
--
-- Lo que SÍ sigue haciendo esta tabla: registrar cada clic a WhatsApp con el
-- identificador de campaña que lo trajo. Eso es captura del lado del sitio y no
-- cruza la frontera: sirve para ver cuántas conversaciones genera cada campaña,
-- no para saber cuánto facturaron.
--
-- No se pierde información: al aplicarse, ninguna fila tenía venta registrada.

-- El índice depende de dos de las columnas; se quita primero para dejar la
-- intención explícita en vez de que Postgres lo arrastre en silencio.
drop index if exists idx_atribucion_pendientes_subida;

alter table atribucion
  drop column if exists venta_cerrada,
  drop column if exists venta_valor,
  drop column if exists venta_fecha,
  drop column if exists subida_a_ads,
  drop column if exists notas;
