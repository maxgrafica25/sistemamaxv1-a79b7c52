
DROP FUNCTION IF EXISTS public.validate_step_type() CASCADE;

CREATE TABLE public.production_step_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6366f1',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_psc_slug ON public.production_step_categories (slug);
CREATE UNIQUE INDEX uq_psc_name_ci ON public.production_step_categories (lower(name));

ALTER TABLE public.production_step_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Categorias visíveis para autenticados"
  ON public.production_step_categories FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins criam categorias"
  ON public.production_step_categories FOR INSERT
  TO authenticated WITH CHECK (public.is_profile_admin(auth.uid()));

CREATE POLICY "Admins atualizam categorias"
  ON public.production_step_categories FOR UPDATE
  TO authenticated USING (public.is_profile_admin(auth.uid()))
  WITH CHECK (public.is_profile_admin(auth.uid()));

CREATE POLICY "Admins excluem categorias não-sistema"
  ON public.production_step_categories FOR DELETE
  TO authenticated USING (public.is_profile_admin(auth.uid()) AND is_system = false);

CREATE TRIGGER trg_psc_updated_at
  BEFORE UPDATE ON public.production_step_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.production_step_categories (slug, name, color, sort_order, is_system) VALUES
  ('impressao', 'Impressão', '#3b82f6', 1, true),
  ('acabamento', 'Acabamento', '#10b981', 2, true),
  ('corte', 'Corte', '#f97316', 3, true),
  ('outro', 'Outro', '#6b7280', 4, true);
