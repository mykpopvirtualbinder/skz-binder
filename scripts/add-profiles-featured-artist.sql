-- Add "artist star" flag to profiles for boosted visibility.
alter table public.profiles
  add column if not exists is_featured_artist boolean not null default false;

create index if not exists profiles_is_featured_artist_idx
  on public.profiles (is_featured_artist);
