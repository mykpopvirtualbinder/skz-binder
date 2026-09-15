-- Seed para el alta (onboarding): grupos BlackPink y BTS + miembros.
-- Ejecuta en el SQL Editor de Supabase (una vez). Si ya existen filas, puedes borrarlas antes o ignorar errores de duplicado.
--
-- Requisitos en tu esquema (ajusta nombres de columna si difieren):
--   groups: id, name, logo_url
--   members: al menos name, image_url, group_id  (y opcional member_id = id)
--
-- Los logos y fotos deben existir en public:
--   /groups/blackpink-logo.png, /groups/bts-logo.png
--   /members/black-pink/*.jpg|png, /members/bts/*.jpg

INSERT INTO public.groups (name, logo_url)
SELECT 'BlackPink', '/groups/blackpink-logo.png'
WHERE NOT EXISTS (
  SELECT 1 FROM public.groups g WHERE lower(trim(g.name)) IN ('blackpink', 'black pink')
);

INSERT INTO public.groups (name, logo_url)
SELECT 'BTS', '/groups/bts-logo.png'
WHERE NOT EXISTS (
  SELECT 1 FROM public.groups g WHERE lower(trim(g.name)) = 'bts'
);

-- BlackPink miembros
INSERT INTO public.members (name, image_url, group_id)
SELECT 'Rosé', '/members/black-pink/rose.jpg', g.id FROM public.groups g WHERE lower(trim(g.name)) IN ('blackpink', 'black pink') LIMIT 1;

INSERT INTO public.members (name, image_url, group_id)
SELECT 'Lisa', '/members/black-pink/lisa.png', g.id FROM public.groups g WHERE lower(trim(g.name)) IN ('blackpink', 'black pink') LIMIT 1;

INSERT INTO public.members (name, image_url, group_id)
SELECT 'Jisoo', '/members/black-pink/jisoo.jpg', g.id FROM public.groups g WHERE lower(trim(g.name)) IN ('blackpink', 'black pink') LIMIT 1;

INSERT INTO public.members (name, image_url, group_id)
SELECT 'Jennie', '/members/black-pink/jennie.jpg', g.id FROM public.groups g WHERE lower(trim(g.name)) IN ('blackpink', 'black pink') LIMIT 1;

-- BTS miembros
INSERT INTO public.members (name, image_url, group_id)
SELECT 'Jungkook', '/members/bts/jungkook.jpg', g.id FROM public.groups g WHERE lower(trim(g.name)) = 'bts' LIMIT 1;

INSERT INTO public.members (name, image_url, group_id)
SELECT 'V', '/members/bts/v.jpg', g.id FROM public.groups g WHERE lower(trim(g.name)) = 'bts' LIMIT 1;

INSERT INTO public.members (name, image_url, group_id)
SELECT 'J-Hope', '/members/bts/j-hope.jpg', g.id FROM public.groups g WHERE lower(trim(g.name)) = 'bts' LIMIT 1;

INSERT INTO public.members (name, image_url, group_id)
SELECT 'Jimin', '/members/bts/jimin.jpg', g.id FROM public.groups g WHERE lower(trim(g.name)) = 'bts' LIMIT 1;

INSERT INTO public.members (name, image_url, group_id)
SELECT 'Jin', '/members/bts/jin.jpg', g.id FROM public.groups g WHERE lower(trim(g.name)) = 'bts' LIMIT 1;

INSERT INTO public.members (name, image_url, group_id)
SELECT 'Suga', '/members/bts/suga.jpg', g.id FROM public.groups g WHERE lower(trim(g.name)) = 'bts' LIMIT 1;

INSERT INTO public.members (name, image_url, group_id)
SELECT 'RM', '/members/bts/rm.jpg', g.id FROM public.groups g WHERE lower(trim(g.name)) = 'bts' LIMIT 1;
