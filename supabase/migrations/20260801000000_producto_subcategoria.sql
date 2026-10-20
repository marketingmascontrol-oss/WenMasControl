-- Sub-categoría (ej. "GUANTE", "BOTA DE CUERO") tal como viene en la nueva
-- plantilla de Excel: más específica que categoria_id, pero por ahora solo se
-- guarda como referencia — el sitio sigue navegando por "categorias".
alter table productos add column if not exists sub_categoria text;
