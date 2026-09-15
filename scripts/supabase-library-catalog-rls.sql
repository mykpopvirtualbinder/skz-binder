-- =============================================================================
-- Library + catálogo photocards: RLS y Storage (Supabase → SQL Editor)
-- =============================================================================
-- Permisos Data API (GRANT): ejecuta también scripts/supabase-data-api-grants.sql
-- para curarte en salud con el cambio de Supabase sobre tablas en `public`.
-- =============================================================================
-- Ejecuta en: Supabase Dashboard → SQL → New query → Run
--
-- Cubre:
--   A) Lectura pública del catálogo: items, groups, albums (Library sin login).
--   B) Inventario propio: user_item_statuses (SELECT/INSERT/UPDATE/DELETE).
--   C) Subidas "mejorar imagen" (modal Library): bucket storage `colaboraciones`
--      + INSERT en aportaciones_pcs.
--   D) Panel admin: lectura de todas las aportaciones / buzón (authenticated).
--
-- NO incluye RLS de binders/binder_pages/page_slots: habilitarlo solo con
-- políticas completas (SELECT+INSERT+…) o romperás crear páginas y slots.
-- Al final hay un bloque COMENTADO de ejemplo si quieres activarlo tú.
--
-- Si una tabla no existe, comenta ese bloque.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- A) Catálogo público: items, groups, albums
-- -----------------------------------------------------------------------------
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.albums ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "items_select_public" ON public.items;
CREATE POLICY "items_select_public"
  ON public.items
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "groups_select_public" ON public.groups;
CREATE POLICY "groups_select_public"
  ON public.groups
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "albums_select_public" ON public.albums;
CREATE POLICY "albums_select_public"
  ON public.albums
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- -----------------------------------------------------------------------------
-- B) Inventario del usuario (stock en Library)
-- -----------------------------------------------------------------------------
ALTER TABLE public.user_item_statuses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_item_statuses_select_own" ON public.user_item_statuses;
CREATE POLICY "user_item_statuses_select_own"
  ON public.user_item_statuses
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "user_item_statuses_insert_own" ON public.user_item_statuses;
CREATE POLICY "user_item_statuses_insert_own"
  ON public.user_item_statuses
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "user_item_statuses_update_own" ON public.user_item_statuses;
CREATE POLICY "user_item_statuses_update_own"
  ON public.user_item_statuses
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "user_item_statuses_delete_own" ON public.user_item_statuses;
CREATE POLICY "user_item_statuses_delete_own"
  ON public.user_item_statuses
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- B2) Favoritos / bias (Library)
-- -----------------------------------------------------------------------------
ALTER TABLE public.user_biases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_biases_select_own" ON public.user_biases;
CREATE POLICY "user_biases_select_own"
  ON public.user_biases
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "user_biases_insert_own" ON public.user_biases;
CREATE POLICY "user_biases_insert_own"
  ON public.user_biases
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "user_biases_delete_own" ON public.user_biases;
CREATE POLICY "user_biases_delete_own"
  ON public.user_biases
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- C) Storage: bucket colaboraciones (nombre = código en LibraryPageClient)
-- -----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('colaboraciones', 'colaboraciones', true, 12582912)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

DROP POLICY IF EXISTS "colaboraciones_objects_public_read" ON storage.objects;
CREATE POLICY "colaboraciones_objects_public_read"
  ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'colaboraciones');

DROP POLICY IF EXISTS "colaboraciones_objects_insert_own_prefix" ON storage.objects;
CREATE POLICY "colaboraciones_objects_insert_own_prefix"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'colaboraciones'
    AND name LIKE (auth.uid()::text || '-%')
  );

DROP POLICY IF EXISTS "colaboraciones_objects_delete_own_prefix" ON storage.objects;
CREATE POLICY "colaboraciones_objects_delete_own_prefix"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'colaboraciones'
    AND name LIKE (auth.uid()::text || '-%')
  );

-- -----------------------------------------------------------------------------
-- D) aportaciones_pcs + buzon_colaboraciones
-- -----------------------------------------------------------------------------
-- AdminPanelClient: SELECT * en ambas tablas. Aquí permitimos SELECT a todo
-- usuario autenticado (útil en equipos pequeños). Para producción estricta,
-- sustituye por rol admin (JWT) o RPC con service_role.

ALTER TABLE public.aportaciones_pcs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "aportaciones_pcs_select_all_auth" ON public.aportaciones_pcs;
CREATE POLICY "aportaciones_pcs_select_all_auth"
  ON public.aportaciones_pcs
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "aportaciones_pcs_insert_own" ON public.aportaciones_pcs;
CREATE POLICY "aportaciones_pcs_insert_own"
  ON public.aportaciones_pcs
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

ALTER TABLE public.buzon_colaboraciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "buzon_select_all_auth" ON public.buzon_colaboraciones;
CREATE POLICY "buzon_select_all_auth"
  ON public.buzon_colaboraciones
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "buzon_insert_auth" ON public.buzon_colaboraciones;
CREATE POLICY "buzon_insert_auth"
  ON public.buzon_colaboraciones
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Panel admin: actualizar / borrar filas (cualquier usuario autenticado: solo para equipo interno).
DROP POLICY IF EXISTS "aportaciones_pcs_update_auth" ON public.aportaciones_pcs;
CREATE POLICY "aportaciones_pcs_update_auth"
  ON public.aportaciones_pcs
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "aportaciones_pcs_delete_auth" ON public.aportaciones_pcs;
CREATE POLICY "aportaciones_pcs_delete_auth"
  ON public.aportaciones_pcs
  FOR DELETE
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "buzon_update_auth" ON public.buzon_colaboraciones;
CREATE POLICY "buzon_update_auth"
  ON public.buzon_colaboraciones
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "buzon_delete_auth" ON public.buzon_colaboraciones;
CREATE POLICY "buzon_delete_auth"
  ON public.buzon_colaboraciones
  FOR DELETE
  TO authenticated
  USING (true);

-- =============================================================================
-- OPCIONAL: RLS en binders (solo si sabes lo que haces; descomenta TODO el bloque)
-- =============================================================================
/*
ALTER TABLE public.binders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.binder_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.page_slots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "binders_select_own" ON public.binders;
CREATE POLICY "binders_select_own" ON public.binders FOR SELECT TO authenticated
  USING (user_id = auth.uid());
DROP POLICY IF EXISTS "binders_insert_own" ON public.binders;
CREATE POLICY "binders_insert_own" ON public.binders FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "binders_update_own" ON public.binders;
CREATE POLICY "binders_update_own" ON public.binders FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "binders_delete_own" ON public.binders;
CREATE POLICY "binders_delete_own" ON public.binders FOR DELETE TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "binder_pages_select_own" ON public.binder_pages;
CREATE POLICY "binder_pages_select_own" ON public.binder_pages FOR SELECT TO authenticated
  USING (binder_id IN (SELECT id FROM public.binders WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "binder_pages_insert_own" ON public.binder_pages;
CREATE POLICY "binder_pages_insert_own" ON public.binder_pages FOR INSERT TO authenticated
  WITH CHECK (binder_id IN (SELECT id FROM public.binders WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "binder_pages_update_own" ON public.binder_pages;
CREATE POLICY "binder_pages_update_own" ON public.binder_pages FOR UPDATE TO authenticated
  USING (binder_id IN (SELECT id FROM public.binders WHERE user_id = auth.uid()))
  WITH CHECK (binder_id IN (SELECT id FROM public.binders WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "binder_pages_delete_own" ON public.binder_pages;
CREATE POLICY "binder_pages_delete_own" ON public.binder_pages FOR DELETE TO authenticated
  USING (binder_id IN (SELECT id FROM public.binders WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "page_slots_select_own" ON public.page_slots;
CREATE POLICY "page_slots_select_own" ON public.page_slots FOR SELECT TO authenticated
  USING (page_id IN (
    SELECT bp.id FROM public.binder_pages bp
    JOIN public.binders b ON b.id = bp.binder_id WHERE b.user_id = auth.uid()));
DROP POLICY IF EXISTS "page_slots_insert_own" ON public.page_slots;
CREATE POLICY "page_slots_insert_own" ON public.page_slots FOR INSERT TO authenticated
  WITH CHECK (page_id IN (
    SELECT bp.id FROM public.binder_pages bp
    JOIN public.binders b ON b.id = bp.binder_id WHERE b.user_id = auth.uid()));
DROP POLICY IF EXISTS "page_slots_update_own" ON public.page_slots;
CREATE POLICY "page_slots_update_own" ON public.page_slots FOR UPDATE TO authenticated
  USING (page_id IN (
    SELECT bp.id FROM public.binder_pages bp
    JOIN public.binders b ON b.id = bp.binder_id WHERE b.user_id = auth.uid()))
  WITH CHECK (page_id IN (
    SELECT bp.id FROM public.binder_pages bp
    JOIN public.binders b ON b.id = bp.binder_id WHERE b.user_id = auth.uid()));
DROP POLICY IF EXISTS "page_slots_delete_own" ON public.page_slots;
CREATE POLICY "page_slots_delete_own" ON public.page_slots FOR DELETE TO authenticated
  USING (page_id IN (
    SELECT bp.id FROM public.binder_pages bp
    JOIN public.binders b ON b.id = bp.binder_id WHERE b.user_id = auth.uid()));
*/

-- =============================================================================
-- Diagnóstico (ejecutar aparte si las URLs en disco son correctas pero no ves foto)
-- =============================================================================
-- SELECT id, member, image_url FROM public.items
-- WHERE id IN (/* ids problemáticos */) OR image_url ILIKE '%007-front-seungmin%';
