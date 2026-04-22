ALTER TABLE public.printer_readings
  ADD COLUMN IF NOT EXISTS consumable_id uuid REFERENCES public.equipment_consumables(id);