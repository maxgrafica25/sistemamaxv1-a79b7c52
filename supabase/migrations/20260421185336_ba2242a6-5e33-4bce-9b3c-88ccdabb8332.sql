ALTER TABLE public.equipment_maintenances ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE public.production_losses     ADD COLUMN IF NOT EXISTS created_by uuid;

UPDATE public.equipment_maintenances SET created_by = '52dbbc24-276a-420c-86db-0e8192324001' WHERE created_by IS NULL;
UPDATE public.production_losses     SET created_by = '52dbbc24-276a-420c-86db-0e8192324001' WHERE created_by IS NULL;

DROP POLICY IF EXISTS "Authenticated can delete equipment_maintenances" ON public.equipment_maintenances;
DROP POLICY IF EXISTS "Authenticated can delete production_losses"     ON public.production_losses;
DROP POLICY IF EXISTS "Authenticated can insert equipment_maintenances" ON public.equipment_maintenances;
DROP POLICY IF EXISTS "Authenticated can insert production_losses"     ON public.production_losses;

CREATE POLICY "Owner or admin delete equipment_maintenances"
  ON public.equipment_maintenances FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.is_profile_admin(auth.uid()));

CREATE POLICY "Owner or admin delete production_losses"
  ON public.production_losses FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.is_profile_admin(auth.uid()));

CREATE POLICY "Insert equipment_maintenances as self"
  ON public.equipment_maintenances FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Insert production_losses as self"
  ON public.production_losses FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());