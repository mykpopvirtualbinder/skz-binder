-- Si la tabla ad_campaigns existe pero falta la columna placement (error en panel Publicidad).

alter table public.ad_campaigns
  add column if not exists placement text default 'sidebar_left';

update public.ad_campaigns
set placement = 'sidebar_left'
where placement is null or trim(placement) = '';
