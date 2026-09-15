-- URL del cursor VIP (Skzoo) guardada en el perfil; null = sin cursor personalizado.
-- Ejecutar en Supabase → SQL Editor (o psql). Tras aplicar, el aviso del schema cache desaparece solo o tras unos segundos.

alter table public.profiles
  add column if not exists cursor_url text;

comment on column public.profiles.cursor_url is 'URL pública del cursor VIP (p. ej. /zootopia/stray-kids/regular/wolfchan.png).';
