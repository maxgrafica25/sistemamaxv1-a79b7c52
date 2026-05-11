ALTER TABLE public.quote_materials
  ADD COLUMN IF NOT EXISTS is_optional boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS quantity_variations jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.quote_labor_steps
  ADD COLUMN IF NOT EXISTS is_optional boolean NOT NULL DEFAULT false;