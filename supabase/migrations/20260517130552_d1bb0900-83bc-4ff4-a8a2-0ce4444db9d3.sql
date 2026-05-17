ALTER TABLE public.cv_calc_config
  ADD COLUMN IF NOT EXISTS sangria_adesivo_mm numeric NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS sangria_lona_mm numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sangria_chapa_mm numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sangria_outro_mm numeric NOT NULL DEFAULT 0;