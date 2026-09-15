-- Si falta la columna active en ad_campaigns.

alter table public.ad_campaigns
  add column if not exists active boolean not null default true;
