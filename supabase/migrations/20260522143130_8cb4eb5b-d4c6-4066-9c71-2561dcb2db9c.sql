DROP POLICY IF EXISTS "Admins can insert quote_presets" ON public.quote_presets;
CREATE POLICY "Authenticated can insert quote_presets"
  ON public.quote_presets FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);