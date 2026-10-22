-- Buzón de info@ dentro del admin. Cloudflare entrega lo que llega; Resend envía lo que sale.
-- Solo el servidor (service_role) lee y escribe. Ni anon ni authenticated tienen acceso.

create table if not exists public.emails (
  id bigint generated always as identity primary key,
  direction text not null check (direction in ('incoming', 'outgoing')),
  folder text not null default 'inbox',
  from_address text not null default '',
  to_address text not null default '',
  subject text not null default '',
  text_body text not null default '',
  html_body text not null default '',
  message_id text,
  in_reply_to text,
  seen boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.email_folders (
  path text primary key,
  parent_path text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists emails_folder_created_idx
  on public.emails (folder, created_at desc);

create unique index if not exists emails_incoming_message_id_idx
  on public.emails (message_id)
  where direction = 'incoming' and message_id is not null and message_id <> '';

alter table public.emails enable row level security;
alter table public.email_folders enable row level security;

revoke all on table public.emails from public, anon, authenticated;
revoke all on table public.email_folders from public, anon, authenticated;

grant select, insert, update, delete on table public.emails to service_role;
grant select, insert, update, delete on table public.email_folders to service_role;
grant usage, select on sequence public.emails_id_seq to service_role;
