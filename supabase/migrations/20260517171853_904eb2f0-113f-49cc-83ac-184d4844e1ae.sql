
-- Adiciona modo "receita" aos acabamentos CV (aditivo, default mantém comportamento atual)
ALTER TABLE public.cv_calc_acabamentos
  ADD COLUMN IF NOT EXISTS pricing_mode text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS markup_override_pct numeric,
  ADD COLUMN IF NOT EXISTS extra_cost_fixo numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS extra_cost_mt2 numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS extra_cost_perimetro numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS extra_cost_unidade numeric NOT NULL DEFAULT 0;

ALTER TABLE public.cv_calc_acabamentos
  DROP CONSTRAINT IF EXISTS cv_calc_acabamentos_pricing_mode_check;
ALTER TABLE public.cv_calc_acabamentos
  ADD CONSTRAINT cv_calc_acabamentos_pricing_mode_check
  CHECK (pricing_mode IN ('manual', 'recipe'));

-- Receita: vínculo many-to-many com supplies + regra de consumo
CREATE TABLE IF NOT EXISTS public.cv_calc_acabamento_recipe_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  acabamento_id uuid NOT NULL REFERENCES public.cv_calc_acabamentos(id) ON DELETE CASCADE,
  supply_id uuid NOT NULL REFERENCES public.supplies(id) ON DELETE RESTRICT,
  consumo_qty numeric NOT NULL DEFAULT 1,
  consumo_tipo text NOT NULL DEFAULT 'por_peca',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cv_recipe_consumo_tipo_check CHECK (
    consumo_tipo IN ('por_peca','por_perimetro_m','por_mt2','por_largura_m','por_altura_m')
  )
);

CREATE INDEX IF NOT EXISTS idx_cv_recipe_acabamento ON public.cv_calc_acabamento_recipe_items(acabamento_id);

ALTER TABLE public.cv_calc_acabamento_recipe_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cv_recipe_items_select ON public.cv_calc_acabamento_recipe_items;
CREATE POLICY cv_recipe_items_select ON public.cv_calc_acabamento_recipe_items
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS cv_recipe_items_admin_all ON public.cv_calc_acabamento_recipe_items;
CREATE POLICY cv_recipe_items_admin_all ON public.cv_calc_acabamento_recipe_items
  FOR ALL TO authenticated
  USING (is_profile_admin(auth.uid()))
  WITH CHECK (is_profile_admin(auth.uid()));

DROP TRIGGER IF EXISTS update_cv_recipe_items_updated_at ON public.cv_calc_acabamento_recipe_items;
CREATE TRIGGER update_cv_recipe_items_updated_at
  BEFORE UPDATE ON public.cv_calc_acabamento_recipe_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
