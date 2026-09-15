-- Creación desde cero. Si la tabla ya existe a medias, usa sync-ad-campaigns-schema.sql
create table if not exists public.ad_campaigns (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subtitle text,
  image_url text,
  target_url text not null,
  placement text not null check (placement in ('sidebar_left', 'sidebar_right', 'tablet_sidebar', 'mobile_inline_top', 'mobile_inline_bottom')),
  device text not null check (device in ('desktop', 'tablet', 'mobile')),
  section text default 'all',
  priority int not null default 0,
  active boolean not null default true,
  start_at timestamptz not null default now(),
  end_at timestamptz not null default (now() + interval '30 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ad_campaigns_active_slot_idx
  on public.ad_campaigns (active, placement, device, start_at, end_at, priority desc);

alter table public.ad_campaigns enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'ad_campaigns'
      and policyname = 'ad_campaigns_public_read'
  ) then
    create policy ad_campaigns_public_read
      on public.ad_campaigns
      for select
      using (active = true and now() between start_at and end_at);
  end if;
end$$;

insert into public.ad_campaigns (title, subtitle, target_url, placement, device, section, priority, active)
values
  ('Tu tienda K-pop aqui', 'Promociona albums, merch y eventos', 'https://mykpopbinder.com/report', 'sidebar_left', 'desktop', 'all', 20, true),
  ('Espacio para artistas', 'Comisiones, prints y fanart patrocinado', 'https://mykpopbinder.com/studio', 'sidebar_right', 'desktop', 'all', 20, true),
  ('Patrocinado', 'Comercios amigos y artistas', 'https://mykpopbinder.com/report', 'mobile_inline_top', 'mobile', 'all', 20, true),
  ('Reserva tu espacio', 'Publicidad para empresas K-pop', 'https://mykpopbinder.com/report', 'mobile_inline_bottom', 'mobile', 'all', 20, true)
on conflict do nothing;
