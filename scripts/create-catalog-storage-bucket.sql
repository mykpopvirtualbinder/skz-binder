-- Bucket Storage solo para el catálogo admin (logos de grupo y fotos de miembro).
-- Ejecuta una vez en Supabase → SQL Editor.
--
-- Después, en Storage → catalog, puedes revisar que sea "Public bucket" si quieres
-- comprobarlo desde la UI (este script ya inserta public = true).

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('catalog', 'catalog', true, 8388608)
ON CONFLICT (id) DO NOTHING;

-- Las URLs públicas (getPublicUrl) necesitan lectura para anon/authenticated según tu proyecto.
DROP POLICY IF EXISTS "storage_catalog_public_read" ON storage.objects;
CREATE POLICY "storage_catalog_public_read"
ON storage.objects
FOR SELECT
USING (bucket_id = 'catalog');
