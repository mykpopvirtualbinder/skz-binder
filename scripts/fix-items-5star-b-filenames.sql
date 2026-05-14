-- Algunas importaciones antiguas usan 007-5star-front-seungmin en la URL;
-- en public/mock-pcs y items_import.csv el fichero es 007-front-seungmin.
-- Ejecutar en Supabase SQL (revisar filas con SELECT antes).

UPDATE public.items
SET
  image_url = replace(image_url, '-5star-front-', '-front-'),
  back_image_url = replace(back_image_url, '-5star-front-', '-front-')
WHERE
  (image_url IS NOT NULL AND image_url LIKE '%/5star/b/%' AND image_url LIKE '%-5star-front-%')
  OR (back_image_url IS NOT NULL AND back_image_url LIKE '%/5star/b/%' AND back_image_url LIKE '%-5star-front-%');
