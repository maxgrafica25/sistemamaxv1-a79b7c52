ALTER TABLE public.global_settings
  ADD COLUMN IF NOT EXISTS tax_pct numeric NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS collection_fee_pct numeric NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS credit_card_pct numeric NOT NULL DEFAULT 5;