-- Ejecutar en Supabase SQL si la tabla ya existía sin estas columnas.

alter table public.ad_campaigns add column if not exists subtitle text;

alter table public.profiles add column if not exists restricted_until timestamptz;

comment on column public.profiles.restricted_until is 'Si is_restricted y fecha futura: restricción hasta esa fecha (opcional; la app puede levantarla al vencer).';
