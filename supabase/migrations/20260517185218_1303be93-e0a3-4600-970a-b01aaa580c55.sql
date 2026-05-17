
ALTER TABLE public.supplies
  ADD COLUMN IF NOT EXISTS modulo text[] NOT NULL DEFAULT '{grafica}';

CREATE INDEX IF NOT EXISTS supplies_modulo_idx ON public.supplies USING GIN (modulo);

-- Backfill: itens já usados em receitas de acabamentos CV ganham 'cv' adicionado
UPDATE public.supplies s
SET modulo = ARRAY(SELECT DISTINCT unnest(s.modulo || ARRAY['cv']))
WHERE EXISTS (
  SELECT 1 FROM public.cv_calc_acabamento_recipe_items r WHERE r.supply_id = s.id
)
AND NOT (s.modulo @> ARRAY['cv']);
