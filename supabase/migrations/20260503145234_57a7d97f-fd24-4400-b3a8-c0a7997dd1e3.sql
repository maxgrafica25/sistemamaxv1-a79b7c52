
ALTER TABLE public.quote_materials
  ADD COLUMN IF NOT EXISTS product_kind text,
  ADD COLUMN IF NOT EXISTS custom_name text,
  ADD COLUMN IF NOT EXISTS reference text,
  ADD COLUMN IF NOT EXISTS generated_title text,
  ADD COLUMN IF NOT EXISTS paper_type text,
  ADD COLUMN IF NOT EXISTS grammage text,
  ADD COLUMN IF NOT EXISTS size text,
  ADD COLUMN IF NOT EXISTS side text;
