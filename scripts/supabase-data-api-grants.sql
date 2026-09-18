-- =============================================================================
-- Supabase Data API: GRANT explícitos en public (curarse en salud)
-- =============================================================================
-- Omite tablas que no existan en tu proyecto (p. ej. public.avatars).
-- Ejecutar en: Dashboard → SQL → New query (como postgres).
-- Verificar después: scripts/supabase-verify-data-api-grants.sql
-- =============================================================================

GRANT USAGE ON SCHEMA public TO anon, authenticated;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- ---------------------------------------------------------------------------
-- GRANTs por tabla (solo si existe)
-- ---------------------------------------------------------------------------
DO $grant$
DECLARE
  tbl text;
  grants text[] := ARRAY[
    -- Catálogo
    'items|SELECT|anon,authenticated',
    'groups|SELECT|anon,authenticated',
    'albums|SELECT|anon,authenticated',
    'versions|SELECT|anon,authenticated',
    'members|SELECT|anon,authenticated',
    'merch_items|SELECT|anon,authenticated',
    'avatars|SELECT|anon,authenticated',

    -- Perfil y colección
    'profiles|SELECT,INSERT,UPDATE,DELETE|authenticated',
    'profiles|SELECT|anon',
    'user_item_statuses|SELECT,INSERT,UPDATE,DELETE|authenticated',
    'user_biases|SELECT,INSERT,DELETE|authenticated',
    'user_vip_unlocks|SELECT,INSERT,UPDATE,DELETE|authenticated',
    'user_merch_statuses|SELECT,INSERT,UPDATE,DELETE|authenticated',
    'user_favorites|SELECT,INSERT,UPDATE,DELETE|authenticated',
    'notifications|SELECT,INSERT,UPDATE,DELETE|authenticated',
    'fanzone_notifications|SELECT,INSERT,UPDATE,DELETE|authenticated',

    -- Binder
    'binders|SELECT,INSERT,UPDATE,DELETE|authenticated',
    'binder_pages|SELECT,INSERT,UPDATE,DELETE|authenticated',
    'page_slots|SELECT,INSERT,UPDATE,DELETE|authenticated',
    'covers|SELECT,INSERT,UPDATE,DELETE|authenticated',

    -- Library colaboraciones
    'aportaciones_pcs|SELECT,INSERT,UPDATE,DELETE|authenticated',
    'buzon_colaboraciones|SELECT,INSERT,UPDATE,DELETE|authenticated',

    -- Artista del mes
    'artist_wall|SELECT|anon,authenticated',
    'artist_wall|INSERT,UPDATE,DELETE|authenticated',
    'artist_wall_likes|SELECT|anon,authenticated',
    'artist_wall_likes|INSERT,DELETE|authenticated',
    'denuncias|SELECT,INSERT,UPDATE,DELETE|authenticated',

    -- Fanzone
    'fanzone_posts|SELECT|anon,authenticated',
    'fanzone_posts|SELECT,INSERT,UPDATE,DELETE|authenticated',
    'fanzone_likes|SELECT|anon,authenticated',
    'fanzone_likes|SELECT,INSERT,DELETE|authenticated',
    'fanzone_comments|SELECT|anon,authenticated',
    'fanzone_comments|SELECT,INSERT,UPDATE,DELETE|authenticated',
    'fanzone_comment_likes|SELECT|anon,authenticated',
    'fanzone_comment_likes|SELECT,INSERT,DELETE|authenticated',

    -- Fanart / Studio
    'fanarts|SELECT|anon,authenticated',
    'fanarts|SELECT,INSERT,UPDATE,DELETE|authenticated',
    'fanart_likes|SELECT|anon,authenticated',
    'fanart_likes|SELECT,INSERT,DELETE|authenticated',
    'fanart_comments|SELECT|anon,authenticated',
    'fanart_comments|SELECT,INSERT,UPDATE,DELETE|authenticated',
    'fanart_comment_likes|SELECT|anon,authenticated',
    'fanart_comment_likes|SELECT,INSERT,DELETE|authenticated',
    'obras|SELECT|anon,authenticated',
    'obras|SELECT,INSERT,UPDATE,DELETE|authenticated',
    'capitulos|SELECT|anon,authenticated',
    'capitulos|SELECT,INSERT,UPDATE,DELETE|authenticated',
    'traducciones|SELECT|anon,authenticated',
    'traducciones|SELECT,INSERT,UPDATE,DELETE|authenticated',
    'solicitudes_artistas|INSERT|anon,authenticated',
    'solicitudes_artistas|SELECT,DELETE|authenticated',

    -- Ads / market
    'ad_campaigns|SELECT|anon,authenticated',
    'ad_campaigns|SELECT,INSERT,UPDATE,DELETE|authenticated',
    'market_ads|SELECT|anon,authenticated',
    'market_ads|SELECT,INSERT,UPDATE,DELETE|authenticated',
    'follows|SELECT,INSERT,DELETE|authenticated'
  ];
  row text;
  parts text[];
  roles text[];
  r text;
BEGIN
  FOREACH row IN ARRAY grants LOOP
    parts := string_to_array(row, '|');
    tbl := parts[1];
    IF to_regclass('public.' || quote_ident(tbl)) IS NULL THEN
      CONTINUE;
    END IF;
    roles := string_to_array(parts[3], ',');
    FOREACH r IN ARRAY roles LOOP
      EXECUTE format(
        'GRANT %s ON TABLE public.%I TO %I',
        parts[2],
        tbl,
        r
      );
    END LOOP;
  END LOOP;
END
$grant$;

GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- Resumen: tablas de la lista que NO existen (informativo)
SELECT
  t.table_name AS omitida_porque_no_existe
FROM (
  SELECT unnest(ARRAY[
    'avatars', 'market_ads', 'follows', 'obras', 'capitulos', 'traducciones',
    'fanzone_comment_likes', 'fanart_comment_likes', 'stripe_fulfillments'
  ]) AS table_name
) t
WHERE to_regclass('public.' || quote_ident(t.table_name)) IS NULL
ORDER BY 1;

-- =============================================================================
-- Tablas nuevas: scripts/SUPABASE_DATA_API.md
-- =============================================================================
