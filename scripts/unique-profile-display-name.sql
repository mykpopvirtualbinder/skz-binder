-- El nombre visible del perfil es único, sin distinguir mayúsculas ni espacios sobrantes.
-- Los vacíos no cuentan. Si ya hay duplicados, este índice no se crea.

create unique index if not exists profiles_display_name_lower_uidx
  on public.profiles (lower(btrim(regexp_replace(display_name, '\s+', ' ', 'g'))))
  where display_name is not null
    and btrim(display_name) <> '';
