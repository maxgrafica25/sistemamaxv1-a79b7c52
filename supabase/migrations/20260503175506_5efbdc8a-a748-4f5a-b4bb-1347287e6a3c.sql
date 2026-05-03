ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS default_quote_validity_days integer NOT NULL DEFAULT 15;

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS main_quantity integer;