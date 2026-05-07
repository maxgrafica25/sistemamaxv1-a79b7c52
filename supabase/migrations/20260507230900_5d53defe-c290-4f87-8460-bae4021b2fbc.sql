ALTER TABLE public.quote_materials
  ADD COLUMN IF NOT EXISTS width_mm numeric,
  ADD COLUMN IF NOT EXISTS height_mm numeric,
  ADD COLUMN IF NOT EXISTS print_colors text;