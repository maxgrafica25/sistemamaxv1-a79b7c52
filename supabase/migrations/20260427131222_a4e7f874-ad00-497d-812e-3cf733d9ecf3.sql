-- 1. Adicionar step_type às tabelas existentes
ALTER TABLE public.production_steps
  ADD COLUMN IF NOT EXISTS step_type text NOT NULL DEFAULT 'outro';

ALTER TABLE public.step_group_items
  ADD COLUMN IF NOT EXISTS step_type text NOT NULL DEFAULT 'outro';

ALTER TABLE public.quote_labor_steps
  ADD COLUMN IF NOT EXISTS step_type text NOT NULL DEFAULT 'outro';

-- 2. Trigger de validação para step_type
CREATE OR REPLACE FUNCTION public.validate_step_type()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.step_type NOT IN ('impressao', 'acabamento', 'corte', 'outro') THEN
    RAISE EXCEPTION 'step_type inválido: %. Use impressao, acabamento, corte ou outro.', NEW.step_type;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_step_type_production_steps ON public.production_steps;
CREATE TRIGGER validate_step_type_production_steps
  BEFORE INSERT OR UPDATE ON public.production_steps
  FOR EACH ROW EXECUTE FUNCTION public.validate_step_type();

DROP TRIGGER IF EXISTS validate_step_type_step_group_items ON public.step_group_items;
CREATE TRIGGER validate_step_type_step_group_items
  BEFORE INSERT OR UPDATE ON public.step_group_items
  FOR EACH ROW EXECUTE FUNCTION public.validate_step_type();

DROP TRIGGER IF EXISTS validate_step_type_quote_labor_steps ON public.quote_labor_steps;
CREATE TRIGGER validate_step_type_quote_labor_steps
  BEFORE INSERT OR UPDATE ON public.quote_labor_steps
  FOR EACH ROW EXECUTE FUNCTION public.validate_step_type();

-- 3. Tabela material_groups
CREATE TABLE IF NOT EXISTS public.material_groups (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.material_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read material_groups"
  ON public.material_groups FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins can insert material_groups"
  ON public.material_groups FOR INSERT
  TO authenticated WITH CHECK (is_profile_admin(auth.uid()));

CREATE POLICY "Admins can update material_groups"
  ON public.material_groups FOR UPDATE
  TO authenticated USING (is_profile_admin(auth.uid()))
  WITH CHECK (is_profile_admin(auth.uid()));

CREATE POLICY "Admins can delete material_groups"
  ON public.material_groups FOR DELETE
  TO authenticated USING (is_profile_admin(auth.uid()));

CREATE TRIGGER update_material_groups_updated_at
  BEFORE UPDATE ON public.material_groups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Tabela material_group_items
CREATE TABLE IF NOT EXISTS public.material_group_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  material_group_id uuid NOT NULL REFERENCES public.material_groups(id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.material_group_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read material_group_items"
  ON public.material_group_items FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins can insert material_group_items"
  ON public.material_group_items FOR INSERT
  TO authenticated WITH CHECK (is_profile_admin(auth.uid()));

CREATE POLICY "Admins can update material_group_items"
  ON public.material_group_items FOR UPDATE
  TO authenticated USING (is_profile_admin(auth.uid()))
  WITH CHECK (is_profile_admin(auth.uid()));

CREATE POLICY "Admins can delete material_group_items"
  ON public.material_group_items FOR DELETE
  TO authenticated USING (is_profile_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_material_group_items_group
  ON public.material_group_items(material_group_id, sort_order);