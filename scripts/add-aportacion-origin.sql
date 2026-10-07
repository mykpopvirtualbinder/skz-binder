-- Origen de una aportación de photocard (álbum, tour, evento, grupo, miembro).
-- Ejecutar una vez en el SQL Editor de Supabase.

alter table public.aportaciones_pcs
  add column if not exists origin_kind text,
  add column if not exists origin_title text,
  add column if not exists group_name text,
  add column if not exists member_name text;
