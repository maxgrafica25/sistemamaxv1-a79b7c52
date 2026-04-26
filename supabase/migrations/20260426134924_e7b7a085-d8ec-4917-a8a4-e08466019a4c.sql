-- 1. Colunas aditivas na tabela quotes
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS view_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_viewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS discount_value numeric,
  ADD COLUMN IF NOT EXISTS discount_type text,
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS is_template boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS options jsonb;

-- 2. RPC para tracking público (única forma de o anon escrever)
CREATE OR REPLACE FUNCTION public.register_quote_view(quote_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.quotes
     SET view_count = COALESCE(view_count, 0) + 1,
         last_viewed_at = now()
   WHERE id = quote_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_quote_view(uuid) TO anon, authenticated;

-- 3. RLS pública de leitura por id (segurança por obscuridade aprovada)
DROP POLICY IF EXISTS "Public can read quote by id" ON public.quotes;
CREATE POLICY "Public can read quote by id"
  ON public.quotes
  FOR SELECT
  TO anon
  USING (true);

DROP POLICY IF EXISTS "Public can read quote_labor_steps" ON public.quote_labor_steps;
CREATE POLICY "Public can read quote_labor_steps"
  ON public.quote_labor_steps
  FOR SELECT
  TO anon
  USING (true);

DROP POLICY IF EXISTS "Public can read quote_materials" ON public.quote_materials;
CREATE POLICY "Public can read quote_materials"
  ON public.quote_materials
  FOR SELECT
  TO anon
  USING (true);

DROP POLICY IF EXISTS "Public can read quote_third_party" ON public.quote_third_party;
CREATE POLICY "Public can read quote_third_party"
  ON public.quote_third_party
  FOR SELECT
  TO anon
  USING (true);

-- 4. Realtime publication para o radar
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'quotes'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.quotes';
  END IF;
END $$;

ALTER TABLE public.quotes REPLICA IDENTITY FULL;