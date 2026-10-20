-- Imagen de portada por categoría, para /categorias (índice del catálogo).
alter table categorias add column if not exists imagen_url text;
