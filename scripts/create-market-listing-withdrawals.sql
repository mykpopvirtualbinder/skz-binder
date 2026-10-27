-- Motivo al quitar un anuncio WTT/WTS del mercado.
-- Ejecutar en Supabase → SQL Editor.

create table if not exists public.market_listing_withdrawals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  source text not null check (source in ('pc', 'merch')),
  status_row_id text not null,
  item_ref text not null,
  listing_type text not null check (listing_type in ('wtt', 'wts')),
  qty integer not null default 1 check (qty > 0),
  stock_deducted integer not null default 0 check (stock_deducted >= 0),
  reason text not null check (reason in ('not_wanted', 'off_platform')),
  created_at timestamptz not null default now()
);

create index if not exists market_listing_withdrawals_user_idx
  on public.market_listing_withdrawals (user_id, created_at desc);

alter table public.market_listing_withdrawals enable row level security;

drop policy if exists "market_listing_withdrawals_insert_own" on public.market_listing_withdrawals;
create policy "market_listing_withdrawals_insert_own"
  on public.market_listing_withdrawals
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "market_listing_withdrawals_select_own" on public.market_listing_withdrawals;
create policy "market_listing_withdrawals_select_own"
  on public.market_listing_withdrawals
  for select
  to authenticated
  using (user_id = auth.uid());

grant select, insert on public.market_listing_withdrawals to authenticated;
grant select, insert, update, delete on public.market_listing_withdrawals to service_role;
