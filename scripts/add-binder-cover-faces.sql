-- Contraportada e interior de la contraportada (binders).
ALTER TABLE public.binders
  ADD COLUMN IF NOT EXISTS back_cover_url text,
  ADD COLUMN IF NOT EXISTS inside_back_url text;
