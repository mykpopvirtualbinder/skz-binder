# Supabase Data API — permisos y tablas nuevas

## Qué avisa Supabase

Desde **octubre 2026**, las tablas **nuevas** en `public` no se exponen solas a PostgREST / `supabase-js`. Hace falta un **`GRANT` explícito**.  
**RLS** sigue controlando **qué filas** ve cada usuario; sin `GRANT`, la petición ni llega a RLS.

## Comprobar el proyecto (una vez)

1. Supabase → **SQL** → pegar y ejecutar **`scripts/supabase-verify-data-api-grants.sql`**.
2. Revisar filas con `anon_select` / `auth_select` = `false` en tablas que sí existen (`en_bd = ok`).
3. Ejecutar **`scripts/supabase-data-api-grants.sql`** (idempotente; comenta líneas de tablas que no existan).
4. Volver a ejecutar el script de verificación.

## Al crear una tabla nueva

En el **mismo** script SQL que hace `CREATE TABLE`:

```sql
CREATE TABLE public.mi_tabla ( ... );

ALTER TABLE public.mi_tabla ENABLE ROW LEVEL SECURITY;
-- políticas RLS aquí ...

-- Data API (obligatorio desde oct 2026 para tablas nuevas)
GRANT SELECT ON TABLE public.mi_tabla TO anon, authenticated;  -- solo si debe leerse sin login
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.mi_tabla TO authenticated;
```

Ajusta según uso:

| Caso | GRANT típico |
|------|----------------|
| Catálogo público (items, groups) | `SELECT` → `anon`, `authenticated` |
| Solo usuarios logueados | `SELECT` (y resto) → solo `authenticated` |
| Solo backend / webhook | no des `GRANT` a `anon`; usa `service_role` en API routes |

Después: añade la tabla a la lista en `supabase-verify-data-api-grants.sql` y a `supabase-data-api-grants.sql`.

## Archivos del repo

| Archivo | Uso |
|---------|-----|
| `scripts/supabase-verify-data-api-grants.sql` | Diagnóstico (solo lectura) |
| `scripts/supabase-data-api-grants.sql` | Aplicar / reparar GRANTs |
| `scripts/supabase-library-catalog-rls.sql` | RLS del catálogo Library |

## No confundir con imágenes en blanco

Los fallos de **photocards** (rutas `/mock-pcs/...`) son **archivos estáticos**, no la Data API de `items`.  
Si `items` carga pero la imagen no: revisar `image_url` y deploy, no solo GRANTs.
