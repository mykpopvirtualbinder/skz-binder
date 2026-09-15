-- Deep links for bell notifications (e.g. market listing from followed seller).
-- Run in Supabase SQL editor if inserts fail with "column metadata does not exist".

alter table public.notifications
  add column if not exists metadata jsonb default '{}'::jsonb;
