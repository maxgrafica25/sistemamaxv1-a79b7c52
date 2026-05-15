ALTER TABLE public.printing_price_items
  ADD COLUMN IF NOT EXISTS is_cut_size boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS purchase_sheet_width_mm numeric NULL,
  ADD COLUMN IF NOT EXISTS purchase_sheet_height_mm numeric NULL;