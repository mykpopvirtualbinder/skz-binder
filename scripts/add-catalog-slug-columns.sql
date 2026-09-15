-- Opcional: slugs internos para importaciones y URLs estables (además del nombre visible en `name`).
-- Ejecutar en Supabase SQL Editor si quieres usar el campo "slug" del panel admin.

ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS slug text;
CREATE UNIQUE INDEX IF NOT EXISTS groups_slug_unique ON public.groups (lower(trim(slug))) WHERE slug IS NOT NULL AND trim(slug) <> '';

ALTER TABLE public.members ADD COLUMN IF NOT EXISTS slug text;
CREATE UNIQUE INDEX IF NOT EXISTS members_group_slug_unique ON public.members (group_id, lower(trim(slug)))
  WHERE slug IS NOT NULL AND trim(slug) <> '';
