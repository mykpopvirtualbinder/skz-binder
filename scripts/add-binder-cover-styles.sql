-- Estilos de portada / contraportada (fill, borde, texto).
ALTER TABLE public.binders
  ADD COLUMN IF NOT EXISTS cover_styles jsonb;
