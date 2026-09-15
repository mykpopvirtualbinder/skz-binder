-- =============================================================================
-- VERIFICACIÓN (solo lectura): permisos Data API en tablas public.*
-- Ejecutar en Supabase → SQL → New query. No modifica nada.
-- =============================================================================
-- Interpretación (solo filas con en_bd = ok):
--   anon_select / auth_select = true  → la API puede leer (RLS filtra filas).
--   false → falta GRANT; ejecuta scripts/supabase-data-api-grants.sql
-- Filas en_bd = — no existe —: tabla no está en tu BD (p. ej. avatars); ignorar.
-- =============================================================================

WITH app_tables AS (
  SELECT unnest(ARRAY[
    'items', 'groups', 'albums', 'versions', 'members', 'merch_items', 'avatars',
    'profiles', 'user_item_statuses', 'user_biases', 'user_vip_unlocks',
    'user_merch_statuses', 'user_favorites', 'notifications', 'fanzone_notifications',
    'binders', 'binder_pages', 'page_slots', 'covers',
    'aportaciones_pcs', 'buzon_colaboraciones',
    'artist_wall', 'artist_wall_likes', 'denuncias',
    'fanzone_posts', 'fanzone_likes', 'fanzone_comments', 'fanzone_comment_likes',
    'fanarts', 'fanart_likes', 'fanart_comments', 'fanart_comment_likes',
    'obras', 'capitulos', 'traducciones', 'solicitudes_artistas',
    'ad_campaigns', 'market_ads', 'follows', 'stripe_fulfillments'
  ]) AS table_name
),
existing AS (
  SELECT t.table_name
  FROM information_schema.tables t
  WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
)
SELECT
  a.table_name,
  CASE WHEN e.table_name IS NULL THEN '— no existe —' ELSE 'ok' END AS en_bd,
  CASE
    WHEN e.table_name IS NULL THEN NULL
    ELSE has_table_privilege('anon', format('public.%I', a.table_name), 'SELECT')
  END AS anon_select,
  CASE
    WHEN e.table_name IS NULL THEN NULL
    ELSE has_table_privilege('authenticated', format('public.%I', a.table_name), 'SELECT')
  END AS auth_select,
  CASE
    WHEN e.table_name IS NULL THEN NULL
    ELSE has_table_privilege('authenticated', format('public.%I', a.table_name), 'INSERT')
  END AS auth_insert,
  CASE
    WHEN e.table_name IS NULL THEN NULL
    ELSE has_table_privilege('authenticated', format('public.%I', a.table_name), 'UPDATE')
  END AS auth_update,
  CASE
    WHEN e.table_name IS NULL THEN NULL
    ELSE has_table_privilege('authenticated', format('public.%I', a.table_name), 'DELETE')
  END AS auth_delete
FROM app_tables a
LEFT JOIN existing e ON e.table_name = a.table_name
ORDER BY
  CASE WHEN e.table_name IS NULL THEN 1 ELSE 0 END,
  a.table_name;

-- Tablas en public que la app NO lista arriba (revisar si necesitan GRANT)
SELECT
  t.table_name AS tabla_sin_listar_en_script,
  has_table_privilege('anon', format('public.%I', t.table_name), 'SELECT') AS anon_select,
  has_table_privilege('authenticated', format('public.%I', t.table_name), 'SELECT') AS auth_select
FROM information_schema.tables t
WHERE t.table_schema = 'public'
  AND t.table_type = 'BASE TABLE'
  AND t.table_name NOT IN (
    'items', 'groups', 'albums', 'versions', 'members', 'merch_items', 'avatars',
    'profiles', 'user_item_statuses', 'user_biases', 'user_vip_unlocks',
    'user_merch_statuses', 'user_favorites', 'notifications', 'fanzone_notifications',
    'binders', 'binder_pages', 'page_slots', 'covers',
    'aportaciones_pcs', 'buzon_colaboraciones',
    'artist_wall', 'artist_wall_likes', 'denuncias',
    'fanzone_posts', 'fanzone_likes', 'fanzone_comments', 'fanzone_comment_likes',
    'fanarts', 'fanart_likes', 'fanart_comments', 'fanart_comment_likes',
    'obras', 'capitulos', 'traducciones', 'solicitudes_artistas',
    'ad_campaigns', 'market_ads', 'follows', 'stripe_fulfillments'
  )
ORDER BY t.table_name;

-- ---------------------------------------------------------------------------
-- Resumen: ¿todo OK en tablas que SÍ existen?
-- (una fila: revisar = 0 → permisos bien en lo listado)
-- ---------------------------------------------------------------------------
WITH app_tables AS (
  SELECT unnest(ARRAY[
    'items', 'groups', 'albums', 'versions', 'members', 'merch_items',
    'profiles', 'user_item_statuses', 'user_biases', 'user_vip_unlocks',
    'user_merch_statuses', 'user_favorites', 'notifications', 'fanzone_notifications',
    'binders', 'binder_pages', 'page_slots', 'covers',
    'aportaciones_pcs', 'buzon_colaboraciones',
    'artist_wall', 'artist_wall_likes', 'denuncias',
    'fanzone_posts', 'fanzone_likes', 'fanzone_comments',
    'fanarts', 'fanart_likes', 'fanart_comments',
    'ad_campaigns', 'solicitudes_artistas'
  ]) AS table_name
),
checks AS (
  SELECT
    a.table_name,
    to_regclass('public.' || quote_ident(a.table_name)) IS NOT NULL AS exists,
    CASE
      WHEN to_regclass('public.' || quote_ident(a.table_name)) IS NULL THEN false
      WHEN a.table_name IN ('items', 'groups', 'albums', 'versions', 'members', 'artist_wall', 'fanzone_posts', 'fanarts', 'ad_campaigns', 'profiles')
        THEN has_table_privilege('anon', format('public.%I', a.table_name), 'SELECT')
      ELSE true
    END AS anon_ok,
    CASE
      WHEN to_regclass('public.' || quote_ident(a.table_name)) IS NULL THEN false
      ELSE has_table_privilege('authenticated', format('public.%I', a.table_name), 'SELECT')
    END AS auth_select_ok
  FROM app_tables a
)
SELECT
  count(*) FILTER (WHERE exists) AS tablas_existentes_revisadas,
  count(*) FILTER (WHERE exists AND NOT anon_ok) AS fallo_lectura_anon,
  count(*) FILTER (WHERE exists AND NOT auth_select_ok) AS fallo_lectura_auth,
  CASE
    WHEN count(*) FILTER (WHERE exists AND (NOT anon_ok OR NOT auth_select_ok)) = 0
    THEN 'OK — permisos base correctos'
    ELSE 'REVISAR — hay tablas con permisos en false (ver consulta 1 arriba)'
  END AS resultado
FROM checks;
