-- Perfiles de GOM (group order manager) en el market.
-- El teléfono y el nombre legal no salen en el listado público: solo los lee el panel, con service role.
-- Ejecutar en Supabase → SQL Editor.

create table if not exists public.gom_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  display_name text not null,
  photo_url text,
  first_name text not null,
  last_name text not null,
  phone text not null,
  instagram text not null default '',
  tiktok text not null default '',
  whatsapp text not null default '',
  facebook text not null default '',
  threads text not null default '',
  x text not null default '',
  youtube text not null default '',
  discord text not null default '',
  telegram text not null default '',
  weverse text not null default '',
  go_types text not null,
  requirements text not null,
  how_it_works text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists gom_profiles_status_idx on public.gom_profiles (status, created_at desc);

create table if not exists public.gom_ratings (
  id uuid primary key default gen_random_uuid(),
  gom_id uuid not null references public.gom_profiles (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  score smallint not null check (score between 1 and 5),
  created_at timestamptz not null default now(),
  unique (gom_id, user_id)
);

create table if not exists public.gom_comments (
  id uuid primary key default gen_random_uuid(),
  gom_id uuid not null references public.gom_profiles (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists gom_comments_gom_idx on public.gom_comments (gom_id, created_at desc);

alter table public.gom_profiles enable row level security;
alter table public.gom_ratings enable row level security;
alter table public.gom_comments enable row level security;

-- Sin políticas para anon/authenticated: el navegador no lee estas tablas.
-- El servidor usa service_role, que no pasa por RLS.

grant select, insert, update, delete on public.gom_profiles to service_role;
grant select, insert, update, delete on public.gom_ratings to service_role;
grant select, insert, update, delete on public.gom_comments to service_role;
