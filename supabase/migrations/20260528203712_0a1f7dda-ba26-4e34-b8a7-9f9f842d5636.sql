-- Add user_id to quotes table
ALTER TABLE public.quotes ADD COLUMN user_id UUID REFERENCES auth.users(id);

-- Backfill user_id for existing quotes (assign to the oldest active user of the company)
UPDATE public.quotes q
SET user_id = (
  SELECT p.user_id 
  FROM public.profiles p 
  WHERE p.empresa_id = q.empresa_id 
    AND p.is_active = true
  ORDER BY p.created_at ASC 
  LIMIT 1
)
WHERE q.user_id IS NULL;

-- Drop old policy
DROP POLICY IF EXISTS tenant_isolation ON public.quotes;

-- Create new strict user isolation policy for quotes
CREATE POLICY "user_isolation_quotes" ON public.quotes
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Update RLS for related tables to follow parent quote ownership
-- quote_materials
DROP POLICY IF EXISTS tenant_isolation ON public.quote_materials;
CREATE POLICY "user_isolation_quote_materials" ON public.quote_materials
FOR ALL
TO authenticated
USING (EXISTS (SELECT 1 FROM public.quotes q WHERE q.id = quote_id AND q.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.quotes q WHERE q.id = quote_id AND q.user_id = auth.uid()));

-- quote_labor_steps
DROP POLICY IF EXISTS tenant_isolation ON public.quote_labor_steps;
CREATE POLICY "user_isolation_quote_labor_steps" ON public.quote_labor_steps
FOR ALL
TO authenticated
USING (EXISTS (SELECT 1 FROM public.quotes q WHERE q.id = quote_id AND q.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.quotes q WHERE q.id = quote_id AND q.user_id = auth.uid()));

-- quote_third_party
DROP POLICY IF EXISTS tenant_isolation ON public.quote_third_party;
CREATE POLICY "user_isolation_quote_third_party" ON public.quote_third_party
FOR ALL
TO authenticated
USING (EXISTS (SELECT 1 FROM public.quotes q WHERE q.id = quote_id AND q.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.quotes q WHERE q.id = quote_id AND q.user_id = auth.uid()));

-- cv_quote_items
DROP POLICY IF EXISTS tenant_isolation ON public.cv_quote_items;
CREATE POLICY "user_isolation_cv_quote_items" ON public.cv_quote_items
FOR ALL
TO authenticated
USING (EXISTS (SELECT 1 FROM public.quotes q WHERE q.id = quote_id AND q.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.quotes q WHERE q.id = quote_id AND q.user_id = auth.uid()));
