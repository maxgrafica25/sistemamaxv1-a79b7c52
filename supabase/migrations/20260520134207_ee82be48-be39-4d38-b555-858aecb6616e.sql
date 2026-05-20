
-- Tabela de Kits de Produto (cadastráveis por tipo de produto)
CREATE TABLE public.product_kits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  product_kind TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_product_kits_product_kind ON public.product_kits(product_kind) WHERE is_active = true;

-- Itens de cada kit
CREATE TABLE public.product_kit_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  kit_id UUID NOT NULL REFERENCES public.product_kits(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  item_type TEXT NOT NULL CHECK (item_type IN ('supply', 'process')),
  supply_id UUID,
  process_step_id UUID,
  role TEXT NOT NULL DEFAULT 'required' CHECK (role IN ('required', 'optional', 'alternative')),
  alternative_group TEXT,
  quantity_formula TEXT NOT NULL DEFAULT 'per_unit' CHECK (quantity_formula IN (
    'per_unit', 'per_sheet', 'per_x_sheets', 'per_perimeter_m', 'per_m2', 'fixed', 'auto_spiral'
  )),
  quantity_value NUMERIC NOT NULL DEFAULT 1,
  auto_select_default BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT chk_supply_or_process CHECK (
    (item_type = 'supply' AND supply_id IS NOT NULL AND process_step_id IS NULL) OR
    (item_type = 'process' AND process_step_id IS NOT NULL AND supply_id IS NULL)
  ),
  CONSTRAINT chk_alt_group CHECK (
    (role = 'alternative' AND alternative_group IS NOT NULL) OR
    (role <> 'alternative')
  )
);

CREATE INDEX idx_product_kit_items_kit_id ON public.product_kit_items(kit_id);

-- RLS
ALTER TABLE public.product_kits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_kit_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read product kits"
  ON public.product_kits FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert product kits"
  ON public.product_kits FOR INSERT TO authenticated
  WITH CHECK (public.is_profile_admin(auth.uid()));

CREATE POLICY "Admins can update product kits"
  ON public.product_kits FOR UPDATE TO authenticated
  USING (public.is_profile_admin(auth.uid()));

CREATE POLICY "Admins can delete product kits"
  ON public.product_kits FOR DELETE TO authenticated
  USING (public.is_profile_admin(auth.uid()));

CREATE POLICY "Authenticated users can read product kit items"
  ON public.product_kit_items FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert product kit items"
  ON public.product_kit_items FOR INSERT TO authenticated
  WITH CHECK (public.is_profile_admin(auth.uid()));

CREATE POLICY "Admins can update product kit items"
  ON public.product_kit_items FOR UPDATE TO authenticated
  USING (public.is_profile_admin(auth.uid()));

CREATE POLICY "Admins can delete product kit items"
  ON public.product_kit_items FOR DELETE TO authenticated
  USING (public.is_profile_admin(auth.uid()));

-- Trigger updated_at
CREATE TRIGGER update_product_kits_updated_at
  BEFORE UPDATE ON public.product_kits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_product_kit_items_updated_at
  BEFORE UPDATE ON public.product_kit_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
