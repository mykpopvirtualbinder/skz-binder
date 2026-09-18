-- Public read for fanfic chapters/translations so language switching works logged-out.
GRANT SELECT ON TABLE public.obras TO anon, authenticated;
GRANT SELECT ON TABLE public.capitulos TO anon, authenticated;
GRANT SELECT ON TABLE public.traducciones TO anon, authenticated;

ALTER TABLE public.obras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.capitulos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.traducciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS obras_select_public ON public.obras;
CREATE POLICY obras_select_public ON public.obras
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS capitulos_select_public ON public.capitulos;
CREATE POLICY capitulos_select_public ON public.capitulos
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS traducciones_select_public ON public.traducciones;
CREATE POLICY traducciones_select_public ON public.traducciones
  FOR SELECT TO anon, authenticated
  USING (true);
