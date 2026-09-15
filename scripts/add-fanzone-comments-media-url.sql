-- Permite adjuntar imagen/video en respuestas del Fan Zone.
alter table public.fanzone_comments
  add column if not exists media_url text;

