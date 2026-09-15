-- =============================================================================
-- ad_campaigns — esquema completo (panel Publicidad + lib/ads.ts)
-- Ejecutar UNA VEZ en Supabase → SQL Editor. Idempotente (ADD COLUMN IF NOT EXISTS).
-- Columnas usadas por la app:
--   title, subtitle, image_url, target_url, placement, device, section,
--   priority, active, start_at, end_at, created_at, updated_at
-- =============================================================================

create table if not exists public.ad_campaigns (
  id uuid primary key default gen_random_uuid()
);

-- Nullable opcionales
alter table public.ad_campaigns add column if not exists subtitle text;
alter table public.ad_campaigns add column if not exists image_url text;

-- Obligatorios con valores por defecto seguros para filas existentes
alter table public.ad_campaigns
  add column if not exists title text not null default 'Anuncio';

alter table public.ad_campaigns
  add column if not exists target_url text not null default 'https://mykpopbinder.com';

alter table public.ad_campaigns
  add column if not exists placement text not null default 'sidebar_left';

alter table public.ad_campaigns
  add column if not exists device text not null default 'desktop';

alter table public.ad_campaigns
  add column if not exists section text default 'all';

alter table public.ad_campaigns
  add column if not exists priority integer not null default 0;

alter table public.ad_campaigns
  add column if not exists active boolean not null default true;

alter table public.ad_campaigns
  add column if not exists start_at timestamptz not null default now();

alter table public.ad_campaigns
  add column if not exists end_at timestamptz not null default (now() + interval '30 days');

alter table public.ad_campaigns
  add column if not exists created_at timestamptz not null default now();

alter table public.ad_campaigns
  add column if not exists updated_at timestamptz not null default now();

-- Datos incoherentes por migraciones parciales
update public.ad_campaigns
set title = 'Anuncio'
where title is null or trim(title) = '';

update public.ad_campaigns
set target_url = 'https://mykpopbinder.com'
where target_url is null or trim(target_url) = '';

update public.ad_campaigns
set section = 'all'
where section is null or trim(section) = '';

update public.ad_campaigns
set start_at = now()
where start_at is null;

update public.ad_campaigns
set end_at = now() + interval '30 days'
where end_at is null;

update public.ad_campaigns
set created_at = now()
where created_at is null;

update public.ad_campaigns
set updated_at = now()
where updated_at is null;

-- Índice para filtros de slots (lib/ads.ts)
create index if not exists ad_campaigns_active_slot_idx
  on public.ad_campaigns (active, placement, device, start_at, end_at, priority desc);

-- updated_at automático en UPDATE
create or replace function public.ad_campaigns_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists ad_campaigns_set_updated_at on public.ad_campaigns;
create trigger ad_campaigns_set_updated_at
  before update on public.ad_campaigns
  for each row
  execute procedure public.ad_campaigns_set_updated_at();

-- RLS: si activas row level security en esta tabla, añade políticas SELECT para anónimos
-- (anuncios activos) y ALL/UPDATE para admins; ver create-ad-campaigns-table.sql como referencia.

comment on table public.ad_campaigns is 'Campañas publicitarias (panel admin Publicidad + huecos AdRail).';
