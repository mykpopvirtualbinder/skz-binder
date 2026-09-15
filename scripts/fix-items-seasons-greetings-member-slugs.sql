-- Corrige slugs de miembro y carpetas en URLs de seasons-greetings (mock-pcs).
-- Ejecutar en Supabase SQL (revisar con SELECT antes de UPDATE).

-- ========== CARPETAS / ÁLBUMES ==========

-- 2021 set → photocard-set (en disco la carpeta es photocard-set)
UPDATE public.items
SET
  image_url = replace(image_url, '/seasons-greetings/korean/2021/set/', '/seasons-greetings/korean/2021/photocard-set/'),
  back_image_url = replace(back_image_url, '/seasons-greetings/korean/2021/set/', '/seasons-greetings/korean/2021/photocard-set/')
WHERE
  image_url LIKE '%/seasons-greetings/korean/2021/set/%'
  OR back_image_url LIKE '%/seasons-greetings/korean/2021/set/%';

-- 2021 polaroid → polaroid-pob
UPDATE public.items
SET
  image_url = replace(image_url, '/seasons-greetings/korean/2021/polaroid/', '/seasons-greetings/korean/2021/polaroid-pob/'),
  back_image_url = replace(back_image_url, '/seasons-greetings/korean/2021/polaroid/', '/seasons-greetings/korean/2021/polaroid-pob/')
WHERE
  (image_url LIKE '%/seasons-greetings/korean/2021/polaroid/%' AND image_url NOT LIKE '%polaroid-pob%')
  OR (back_image_url LIKE '%/seasons-greetings/korean/2021/polaroid/%' AND back_image_url NOT LIKE '%polaroid-pob%');

-- Álbum corto → slug completo (solo si la URL tiene /korean/2024/ sin "perfect-day", etc.)
UPDATE public.items
SET
  image_url = replace(image_url, '/seasons-greetings/korean/2022/', '/seasons-greetings/korean/2022-room-mates/'),
  back_image_url = replace(back_image_url, '/seasons-greetings/korean/2022/', '/seasons-greetings/korean/2022-room-mates/')
WHERE
  (image_url LIKE '%/seasons-greetings/korean/2022/%' AND image_url NOT LIKE '%2022-room-mates%')
  OR (back_image_url LIKE '%/seasons-greetings/korean/2022/%' AND back_image_url NOT LIKE '%2022-room-mates%');

UPDATE public.items
SET
  image_url = replace(image_url, '/seasons-greetings/korean/2024/', '/seasons-greetings/korean/2024-perfect-day/'),
  back_image_url = replace(back_image_url, '/seasons-greetings/korean/2024/', '/seasons-greetings/korean/2024-perfect-day/')
WHERE
  (image_url LIKE '%/seasons-greetings/korean/2024/%' AND image_url NOT LIKE '%2024-perfect-day%')
  OR (back_image_url LIKE '%/seasons-greetings/korean/2024/%' AND back_image_url NOT LIKE '%2024-perfect-day%');

UPDATE public.items
SET
  image_url = replace(image_url, '/seasons-greetings/korean/2025/', '/seasons-greetings/korean/2025-the-street-kids/'),
  back_image_url = replace(back_image_url, '/seasons-greetings/korean/2025/', '/seasons-greetings/korean/2025-the-street-kids/')
WHERE
  (image_url LIKE '%/seasons-greetings/korean/2025/%' AND image_url NOT LIKE '%2025-the-street-kids%')
  OR (back_image_url LIKE '%/seasons-greetings/korean/2025/%' AND back_image_url NOT LIKE '%2025-the-street-kids%');

UPDATE public.items
SET
  image_url = replace(image_url, '/seasons-greetings/korean/2026/', '/seasons-greetings/korean/2026-starlight-super-club/'),
  back_image_url = replace(back_image_url, '/seasons-greetings/korean/2026/', '/seasons-greetings/korean/2026-starlight-super-club/')
WHERE
  (image_url LIKE '%/seasons-greetings/korean/2026/%' AND image_url NOT LIKE '%2026-starlight-super-club%')
  OR (back_image_url LIKE '%/seasons-greetings/korean/2026/%' AND back_image_url NOT LIKE '%2026-starlight-super-club%');

-- pob-polaroid-unit → pob-polaroids-unit (2022 Room Mates)
UPDATE public.items
SET
  image_url = replace(image_url, '/pob-polaroid-unit/', '/pob-polaroids-unit/'),
  back_image_url = replace(back_image_url, '/pob-polaroid-unit/', '/pob-polaroids-unit/')
WHERE
  image_url LIKE '%/pob-polaroid-unit/%'
  OR back_image_url LIKE '%/pob-polaroid-unit/%';

-- Unit en carpeta equivocada: pob-polaroids/ + nombre con '+' → pob-polaroids-unit/
UPDATE public.items
SET image_url = replace(image_url, '/pob-polaroids/', '/pob-polaroids-unit/')
WHERE
  image_url LIKE '%/pob-polaroids/%'
  AND image_url NOT LIKE '%/pob-polaroids-unit/%'
  AND (image_url LIKE '%+%' OR image_url LIKE '%\%%2B%' OR image_url LIKE '%\%%2b%');

UPDATE public.items
SET back_image_url = replace(back_image_url, '/pob-polaroids/', '/pob-polaroids-unit/')
WHERE
  back_image_url LIKE '%/pob-polaroids/%'
  AND back_image_url NOT LIKE '%/pob-polaroids-unit/%'
  AND (back_image_url LIKE '%+%' OR back_image_url LIKE '%\%%2B%' OR back_image_url LIKE '%\%%2b%');

-- ========== CARPETAS POB POR AÑO (nombres en disco distintos) ==========

-- 2024 / 2026: en disco `pob-applemusic` (sin guión)
UPDATE public.items
SET
  image_url = replace(image_url, '/2024-perfect-day/pob-apple-music/', '/2024-perfect-day/pob-applemusic/'),
  back_image_url = replace(back_image_url, '/2024-perfect-day/pob-apple-music/', '/2024-perfect-day/pob-applemusic/')
WHERE image_url LIKE '%/2024-perfect-day/pob-apple-music/%'
   OR back_image_url LIKE '%/2024-perfect-day/pob-apple-music/%';

UPDATE public.items
SET
  image_url = replace(image_url, '/2026-starlight-super-club/pob-apple-music/', '/2026-starlight-super-club/pob-applemusic/'),
  back_image_url = replace(back_image_url, '/2026-starlight-super-club/pob-apple-music/', '/2026-starlight-super-club/pob-applemusic/')
WHERE image_url LIKE '%/2026-starlight-super-club/pob-apple-music/%'
   OR back_image_url LIKE '%/2026-starlight-super-club/pob-apple-music/%';

-- 2025: en disco `pob-apple-music` (con guión)
UPDATE public.items
SET
  image_url = replace(image_url, '/2025-the-street-kids/pob-applemusic/', '/2025-the-street-kids/pob-apple-music/'),
  back_image_url = replace(back_image_url, '/2025-the-street-kids/pob-applemusic/', '/2025-the-street-kids/pob-apple-music/')
WHERE image_url LIKE '%/2025-the-street-kids/pob-applemusic/%'
   OR back_image_url LIKE '%/2025-the-street-kids/pob-applemusic/%';

-- 2026: musickorea; 2025: music-korea
UPDATE public.items
SET
  image_url = replace(image_url, '/2026-starlight-super-club/pob-music-korea/', '/2026-starlight-super-club/pob-musickorea/'),
  back_image_url = replace(back_image_url, '/2026-starlight-super-club/pob-music-korea/', '/2026-starlight-super-club/pob-musickorea/')
WHERE image_url LIKE '%/2026-starlight-super-club/pob-music-korea/%'
   OR back_image_url LIKE '%/2026-starlight-super-club/pob-music-korea/%';

UPDATE public.items
SET
  image_url = replace(image_url, '/2025-the-street-kids/pob-musickorea/', '/2025-the-street-kids/pob-music-korea/'),
  back_image_url = replace(back_image_url, '/2025-the-street-kids/pob-musickorea/', '/2025-the-street-kids/pob-music-korea/')
WHERE image_url LIKE '%/2025-the-street-kids/pob-musickorea/%'
   OR back_image_url LIKE '%/2025-the-street-kids/pob-musickorea/%';

-- 2026: typo en carpeta `pob-kpop-toguether`
UPDATE public.items
SET
  image_url = replace(image_url, '/pob-kpop-together/', '/pob-kpop-toguether/'),
  back_image_url = replace(back_image_url, '/pob-kpop-together/', '/pob-kpop-toguether/')
WHERE image_url LIKE '%/pob-kpop-together/%' OR back_image_url LIKE '%/pob-kpop-together/%';

-- Unit: espacio entre miembros en nombre de archivo → '+'
UPDATE public.items
SET
  image_url = replace(image_url, '-front-bang-chan changbin.', '-front-bang-chan+changbin.'),
  back_image_url = replace(back_image_url, '-front-bang-chan changbin.', '-front-bang-chan+changbin.')
WHERE image_url LIKE '%-front-bang-chan changbin.%' OR back_image_url LIKE '%-front-bang-chan changbin.%';

UPDATE public.items
SET
  image_url = replace(image_url, '-front-lee-know felix.', '-front-lee-know+felix.'),
  back_image_url = replace(back_image_url, '-front-lee-know felix.', '-front-lee-know+felix.')
WHERE image_url LIKE '%-front-lee-know felix.%' OR back_image_url LIKE '%-front-lee-know felix.%';

UPDATE public.items
SET
  image_url = replace(image_url, '-front-han hyunjin.', '-front-han+hyunjin.'),
  back_image_url = replace(back_image_url, '-front-han hyunjin.', '-front-han+hyunjin.')
WHERE image_url LIKE '%-front-han hyunjin.%' OR back_image_url LIKE '%-front-han hyunjin.%';

UPDATE public.items
SET
  image_url = replace(image_url, '-front-in seungmin.', '-front-in+seungmin.'),
  back_image_url = replace(back_image_url, '-front-in seungmin.', '-front-in+seungmin.')
WHERE image_url LIKE '%-front-in seungmin.%' OR back_image_url LIKE '%-front-in seungmin.%';

-- ========== MIEMBROS (slugs en nombre de archivo) ==========

-- bangchan → bang-chan
UPDATE public.items
SET
  image_url = replace(image_url, '-bangchan.', '-bang-chan.'),
  back_image_url = replace(back_image_url, '-bangchan.', '-bang-chan.')
WHERE
  (image_url LIKE '%/seasons-greetings/%' AND image_url LIKE '%-bangchan.%')
  OR (back_image_url LIKE '%/seasons-greetings/%' AND back_image_url LIKE '%-bangchan.%');

UPDATE public.items
SET
  image_url = replace(image_url, '-bangchan+', '-bang-chan+'),
  back_image_url = replace(back_image_url, '-bangchan+', '-bang-chan+')
WHERE
  (image_url LIKE '%/seasons-greetings/%' AND image_url LIKE '%-bangchan+%')
  OR (back_image_url LIKE '%/seasons-greetings/%' AND back_image_url LIKE '%-bangchan+%');

-- leeknow → lee-know
UPDATE public.items
SET
  image_url = replace(image_url, '-leeknow.', '-lee-know.'),
  back_image_url = replace(back_image_url, '-leeknow.', '-lee-know.')
WHERE
  (image_url LIKE '%/seasons-greetings/%' AND image_url LIKE '%-leeknow.%')
  OR (back_image_url LIKE '%/seasons-greetings/%' AND back_image_url LIKE '%-leeknow.%');

UPDATE public.items
SET
  image_url = replace(image_url, '-leeknow+', '-lee-know+'),
  back_image_url = replace(back_image_url, '-leeknow+', '-lee-know+')
WHERE
  (image_url LIKE '%/seasons-greetings/%' AND image_url LIKE '%-leeknow+%')
  OR (back_image_url LIKE '%/seasons-greetings/%' AND back_image_url LIKE '%-leeknow+%');

-- seung-min → seungmin
UPDATE public.items
SET
  image_url = replace(image_url, '-seung-min.', '-seungmin.'),
  back_image_url = replace(back_image_url, '-seung-min.', '-seungmin.')
WHERE
  (image_url LIKE '%/seasons-greetings/korean/%' AND image_url LIKE '%-seung-min.%')
  OR (back_image_url LIKE '%/seasons-greetings/korean/%' AND back_image_url LIKE '%-seung-min.%');

UPDATE public.items
SET
  image_url = replace(image_url, '-seung-min+', '-seungmin+'),
  back_image_url = replace(back_image_url, '-seung-min+', '-seungmin+')
WHERE
  (image_url LIKE '%/seasons-greetings/korean/%' AND image_url LIKE '%-seung-min+%')
  OR (back_image_url LIKE '%/seasons-greetings/korean/%' AND back_image_url LIKE '%-seung-min+%');

-- hyun-jin → hyunjin
UPDATE public.items
SET
  image_url = replace(image_url, '-hyun-jin.', '-hyunjin.'),
  back_image_url = replace(back_image_url, '-hyun-jin.', '-hyunjin.')
WHERE
  (image_url LIKE '%/seasons-greetings/%' AND image_url LIKE '%-hyun-jin.%')
  OR (back_image_url LIKE '%/seasons-greetings/%' AND back_image_url LIKE '%-hyun-jin.%');

-- chang-bin → changbin (sets, garden, 2024 POB, 2026 POB, 2021 polaroid-pob, 2022 unit…)
UPDATE public.items
SET
  image_url = replace(image_url, '-chang-bin.', '-changbin.'),
  back_image_url = replace(back_image_url, '-chang-bin.', '-changbin.')
WHERE
  (
    image_url LIKE '%/seasons-greetings/korean/%'
    AND image_url LIKE '%-chang-bin.%'
    AND image_url NOT LIKE '%/2025-the-street-kids/pob%'
  )
  OR (
    back_image_url LIKE '%/seasons-greetings/korean/%'
    AND back_image_url LIKE '%-chang-bin.%'
    AND back_image_url NOT LIKE '%/2025-the-street-kids/pob%'
  );

UPDATE public.items
SET
  image_url = replace(image_url, '-chang-bin+', '-changbin+'),
  back_image_url = replace(back_image_url, '-chang-bin+', '-changbin+')
WHERE
  (
    image_url LIKE '%/seasons-greetings/korean/%'
    AND image_url LIKE '%-chang-bin+%'
    AND image_url NOT LIKE '%/2025-the-street-kids/pob%'
  )
  OR (
    back_image_url LIKE '%/seasons-greetings/korean/%'
    AND back_image_url LIKE '%-chang-bin+%'
    AND back_image_url NOT LIKE '%/2025-the-street-kids/pob%'
  );

-- changbin → chang-bin SOLO en POB 2025 Street Kids (único año con chang-bin en disco en POB)
UPDATE public.items
SET
  image_url = replace(image_url, '-changbin.', '-chang-bin.'),
  back_image_url = replace(back_image_url, '-changbin.', '-chang-bin.')
WHERE
  (
    image_url LIKE '%/seasons-greetings/korean/2025-the-street-kids/pob%'
    AND image_url LIKE '%-changbin.%'
  )
  OR (
    back_image_url LIKE '%/seasons-greetings/korean/2025-the-street-kids/pob%'
    AND back_image_url LIKE '%-changbin.%'
  );

UPDATE public.items
SET
  image_url = replace(image_url, '-changbin+', '-chang-bin+'),
  back_image_url = replace(back_image_url, '-changbin+', '-chang-bin+')
WHERE
  (
    image_url LIKE '%/seasons-greetings/korean/2025-the-street-kids/pob%'
    AND image_url LIKE '%-changbin+%'
  )
  OR (
    back_image_url LIKE '%/seasons-greetings/korean/2025-the-street-kids/pob%'
    AND back_image_url LIKE '%-changbin+%'
  );

-- JP 2026-force: photocard-set → photo-card-set
UPDATE public.items
SET
  image_url = replace(
    image_url,
    '/seasons-greetings/japanese/2026-force/photocard-set/',
    '/seasons-greetings/japanese/2026-force/photo-card-set/'
  ),
  back_image_url = replace(
    back_image_url,
    '/seasons-greetings/japanese/2026-force/photocard-set/',
    '/seasons-greetings/japanese/2026-force/photo-card-set/'
  )
WHERE
  image_url LIKE '%/seasons-greetings/japanese/2026-force/photocard-set/%'
  OR back_image_url LIKE '%/seasons-greetings/japanese/2026-force/photocard-set/%';
