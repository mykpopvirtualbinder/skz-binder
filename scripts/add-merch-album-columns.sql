-- Optional metadata for merch_items rows with category = 'Álbumes' (album catalog tab).
ALTER TABLE merch_items ADD COLUMN IF NOT EXISTS album_title text;
ALTER TABLE merch_items ADD COLUMN IF NOT EXISTS album_type text;
ALTER TABLE merch_items ADD COLUMN IF NOT EXISTS album_version text;

COMMENT ON COLUMN merch_items.album_title IS 'Release title, e.g. I am NOT';
COMMENT ON COLUMN merch_items.album_type IS 'Packaging / soporte físico (Accordion, Vinyl, Paper case, Jewel case, Postcard, Platform, …). Texto libre o slug; la UI puede formatear slugs conocidos.';
COMMENT ON COLUMN merch_items.album_version IS 'Variante de edición (A/B, Limited, POB concreto, …). Complementa album_type; fans puristas: guardar el nombre exacto del mercado.';
