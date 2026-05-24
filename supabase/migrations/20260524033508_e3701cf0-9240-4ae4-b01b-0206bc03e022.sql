ALTER TABLE public.finishings_price_items
  ADD COLUMN IF NOT EXISTS auto_format_multiplier boolean NOT NULL DEFAULT false;

UPDATE public.finishings_price_items
  SET auto_format_multiplier = true
  WHERE pricing_model = 'per_sheet' AND auto_format_multiplier = false;