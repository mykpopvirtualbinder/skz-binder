-- Desbloqueos individuales de perks VIP por K-oins.
create table if not exists public.user_vip_unlocks (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  unlock_key text not null,
  created_at timestamptz not null default now(),
  unique (user_id, unlock_key)
);

create index if not exists user_vip_unlocks_user_id_idx
  on public.user_vip_unlocks (user_id);

