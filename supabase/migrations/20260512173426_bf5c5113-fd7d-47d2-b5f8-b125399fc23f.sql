ALTER TABLE public.supplies
  ADD COLUMN margem_pct numeric NOT NULL DEFAULT 0
  CHECK (margem_pct >= 0 AND margem_pct <= 500);