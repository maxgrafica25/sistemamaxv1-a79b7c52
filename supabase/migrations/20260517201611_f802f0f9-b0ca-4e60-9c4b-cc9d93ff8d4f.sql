
CREATE TABLE public.cv_calc_acabamento_labor_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  acabamento_id uuid NOT NULL REFERENCES public.cv_calc_acabamentos(id) ON DELETE CASCADE,
  production_step_id uuid REFERENCES public.production_steps(id) ON DELETE SET NULL,
  descricao text NOT NULL DEFAULT '',
  time_minutes numeric NOT NULL DEFAULT 0,
  consumo_tipo text NOT NULL DEFAULT 'fixo',
  consumo_qty numeric NOT NULL DEFAULT 1,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_cv_labor_items_acab ON public.cv_calc_acabamento_labor_items(acabamento_id);

ALTER TABLE public.cv_calc_acabamento_labor_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cv_labor_items_select"
  ON public.cv_calc_acabamento_labor_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "cv_labor_items_admin_all"
  ON public.cv_calc_acabamento_labor_items FOR ALL
  TO authenticated
  USING (is_profile_admin(auth.uid()))
  WITH CHECK (is_profile_admin(auth.uid()));

CREATE TRIGGER trg_cv_labor_items_updated
  BEFORE UPDATE ON public.cv_calc_acabamento_labor_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
