ALTER TABLE public.consumable_price_history
  ADD COLUMN IF NOT EXISTS supplier text,
  ADD COLUMN IF NOT EXISTS invoice_ref text,
  ADD COLUMN IF NOT EXISTS quantity numeric NOT NULL DEFAULT 1;

ALTER TABLE public.consumable_price_history
  ADD COLUMN IF NOT EXISTS unit_price numeric
  GENERATED ALWAYS AS (price / NULLIF(quantity, 0)) STORED;

CREATE INDEX IF NOT EXISTS idx_cph_supplier
  ON public.consumable_price_history(supplier);

CREATE INDEX IF NOT EXISTS idx_cph_consumable_date
  ON public.consumable_price_history(consumable_id, change_date DESC);

ALTER TABLE public.consumable_price_history REPLICA IDENTITY DEFAULT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'consumable_price_history'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.consumable_price_history';
  END IF;
END $$;