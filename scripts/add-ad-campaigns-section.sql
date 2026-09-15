-- Si falta la columna section en ad_campaigns (error al cargar campañas).

alter table public.ad_campaigns
  add column if not exists section text default 'all';

update public.ad_campaigns
set section = 'all'
where section is null or trim(section) = '';
