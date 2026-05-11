ALTER TABLE public.quote_materials
  ADD COLUMN IF NOT EXISTS booklet_pages integer,
  ADD COLUMN IF NOT EXISTS booklet_units integer,
  ADD COLUMN IF NOT EXISTS booklet_duplex boolean;