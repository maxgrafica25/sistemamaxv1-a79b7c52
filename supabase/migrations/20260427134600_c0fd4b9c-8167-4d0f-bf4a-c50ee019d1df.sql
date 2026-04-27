ALTER TABLE public.material_group_items
  ADD COLUMN IF NOT EXISTS supply_id uuid REFERENCES public.supplies(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_material_group_items_supply_id
  ON public.material_group_items(supply_id);