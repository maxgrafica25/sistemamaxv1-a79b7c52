ALTER TABLE public.sites_monitorados
  ADD COLUMN IF NOT EXISTS scrape_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS scrape_error text,
  ADD COLUMN IF NOT EXISTS scrape_source text;