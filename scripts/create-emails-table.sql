-- Buzón de info@ dentro del admin. Cloudflare entrega lo que llega; Resend envía lo que sale.
-- La tabla emails ya puede existir (id uuid, sender, recipient, body_text, direction).
-- Este script añade lo que falta y se puede ejecutar otra vez.
-- Solo el servidor (service_role) lee y escribe. Ni anon ni authenticated tienen acceso.

create table if not exists public.emails (
  id uuid primary key default gen_random_uuid(),
  sender text not null default '',
  recipient text not null default '',
  subject text not null default '',
  body_text text not null default '',
  direction text not null default 'incoming',
  created_at timestamptz not null default now()
);

alter table public.emails alter column id set default gen_random_uuid();

alter table public.emails add column if not exists folder text;
alter table public.emails add column if not exists html_body text;
alter table public.emails add column if not exists message_id text;
alter table public.emails add column if not exists in_reply_to text;
alter table public.emails add column if not exists seen boolean;

update public.emails
set folder = case when lower(coalesce(direction, '')) = 'outgoing' then 'sent' else 'inbox' end
where folder is null or btrim(folder) = '';

update public.emails set html_body = '' where html_body is null;
update public.emails set seen = false where seen is null;
update public.emails set direction = 'incoming' where direction is null or btrim(direction) = '';

alter table public.emails alter column folder set default 'inbox';
alter table public.emails alter column html_body set default '';
alter table public.emails alter column seen set default false;
alter table public.emails alter column direction set default 'incoming';
alter table public.emails alter column folder set not null;
alter table public.emails alter column html_body set not null;
alter table public.emails alter column seen set not null;

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

create table if not exists public.email_attachments (
  id uuid primary key default gen_random_uuid(),
  email_id uuid not null references public.emails (id) on delete cascade,
  filename text not null default 'adjunto',
  content_type text not null default 'application/octet-stream',
  size_bytes integer not null default 0,
  content_base64 text not null,
  cid text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists email_attachments_email_id_idx
  on public.email_attachments (email_id);

alter table public.email_attachments enable row level security;

revoke all on table public.email_attachments from public, anon, authenticated;

grant select, insert, update, delete on table public.emails to service_role;
grant select, insert, update, delete on table public.email_folders to service_role;
grant select, insert, update, delete on table public.email_attachments to service_role;

do $$
begin
  if to_regclass('public.emails_id_seq') is not null then
    execute 'grant usage, select on sequence public.emails_id_seq to service_role';
  end if;
end $$;
