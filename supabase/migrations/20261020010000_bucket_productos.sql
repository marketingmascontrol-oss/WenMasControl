-- El bucket público de imágenes. En Wincol se creó a mano desde el panel de
-- Supabase y no quedó en ninguna migración; acá va escrito para que un proyecto
-- nuevo quede completo con `supabase db push` y nada dependa de la memoria.
-- Las categorías también guardan su portada acá (ver subirImagenCategoria).
insert into storage.buckets (id, name, public)
values ('productos', 'productos', true)
on conflict (id) do nothing;
