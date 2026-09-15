-- Si falta la columna priority en ad_campaigns (error al cargar campañas / ordenar).

alter table public.ad_campaigns
  add column if not exists priority integer not null default 0;
