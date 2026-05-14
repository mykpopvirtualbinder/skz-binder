-- Corrige carpeta errónea en URLs de Season's Greetings JP 2026 (photocard-set vs photo-card-set).
-- En public/mock-pcs la carpeta correcta es `photo-card-set`.

UPDATE public.items
SET
  image_url = replace(
    image_url,
    '/photocards/seasons-greetings/japanese/2026-force/photocard-set/',
    '/photocards/seasons-greetings/japanese/2026-force/photo-card-set/'
  ),
  back_image_url = replace(
    back_image_url,
    '/photocards/seasons-greetings/japanese/2026-force/photocard-set/',
    '/photocards/seasons-greetings/japanese/2026-force/photo-card-set/'
  )
WHERE
  (image_url IS NOT NULL AND image_url LIKE '%/2026-force/photocard-set/%')
  OR (back_image_url IS NOT NULL AND back_image_url LIKE '%/2026-force/photocard-set/%');
