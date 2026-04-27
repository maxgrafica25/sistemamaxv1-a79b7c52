-- ============= CV_MATERIALS =============
CREATE TABLE public.cv_materials (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text NOT NULL,
  categoria text NOT NULL CHECK (categoria IN ('lona','adesivo','chapa','outro')),
  largura_util_cm numeric NOT NULL DEFAULT 0,
  custo_mt2 numeric NOT NULL DEFAULT 0,
  margem_mt2_pct numeric NOT NULL DEFAULT 0,
  valor_minimo numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.cv_materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read cv_materials" ON public.cv_materials
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert cv_materials" ON public.cv_materials
  FOR INSERT TO authenticated WITH CHECK (is_profile_admin(auth.uid()));
CREATE POLICY "Admins can update cv_materials" ON public.cv_materials
  FOR UPDATE TO authenticated USING (is_profile_admin(auth.uid())) WITH CHECK (is_profile_admin(auth.uid()));
CREATE POLICY "Admins can delete cv_materials" ON public.cv_materials
  FOR DELETE TO authenticated USING (is_profile_admin(auth.uid()));

CREATE TRIGGER update_cv_materials_updated_at
BEFORE UPDATE ON public.cv_materials
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============= CV_PRINTERS =============
CREATE TABLE public.cv_printers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text NOT NULL,
  tecnologia text NOT NULL DEFAULT 'eco-solvente',
  largura_max_cm numeric NOT NULL DEFAULT 0,
  custo_mt2_print numeric NOT NULL DEFAULT 0,
  margem_mt2_print_pct numeric NOT NULL DEFAULT 0,
  custo_fixo_setup numeric NOT NULL DEFAULT 0,
  lucro_fixo_setup numeric NOT NULL DEFAULT 0,
  categorias_compativeis text[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.cv_printers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read cv_printers" ON public.cv_printers
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert cv_printers" ON public.cv_printers
  FOR INSERT TO authenticated WITH CHECK (is_profile_admin(auth.uid()));
CREATE POLICY "Admins can update cv_printers" ON public.cv_printers
  FOR UPDATE TO authenticated USING (is_profile_admin(auth.uid())) WITH CHECK (is_profile_admin(auth.uid()));
CREATE POLICY "Admins can delete cv_printers" ON public.cv_printers
  FOR DELETE TO authenticated USING (is_profile_admin(auth.uid()));

CREATE TRIGGER update_cv_printers_updated_at
BEFORE UPDATE ON public.cv_printers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============= CV_FINISHES =============
CREATE TABLE public.cv_finishes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text NOT NULL,
  categoria_compativel text[] NOT NULL DEFAULT '{}',
  tipo_calculo text NOT NULL CHECK (tipo_calculo IN ('unidade','mt2','perimetro_metro','fixo')),
  custo numeric NOT NULL DEFAULT 0,
  margem_pct numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.cv_finishes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read cv_finishes" ON public.cv_finishes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert cv_finishes" ON public.cv_finishes
  FOR INSERT TO authenticated WITH CHECK (is_profile_admin(auth.uid()));
CREATE POLICY "Admins can update cv_finishes" ON public.cv_finishes
  FOR UPDATE TO authenticated USING (is_profile_admin(auth.uid())) WITH CHECK (is_profile_admin(auth.uid()));
CREATE POLICY "Admins can delete cv_finishes" ON public.cv_finishes
  FOR DELETE TO authenticated USING (is_profile_admin(auth.uid()));

CREATE TRIGGER update_cv_finishes_updated_at
BEFORE UPDATE ON public.cv_finishes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============= CV_QUOTE_ITEMS =============
CREATE TABLE public.cv_quote_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_id uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  material_id uuid REFERENCES public.cv_materials(id) ON DELETE SET NULL,
  printer_id uuid REFERENCES public.cv_printers(id) ON DELETE SET NULL,
  material_nome text,
  printer_nome text,
  largura_cm numeric NOT NULL DEFAULT 0,
  altura_cm numeric NOT NULL DEFAULT 0,
  quantidade integer NOT NULL DEFAULT 1,
  area_total_m2 numeric NOT NULL DEFAULT 0,
  tem_emenda boolean NOT NULL DEFAULT false,
  aplicou_minimo boolean NOT NULL DEFAULT false,
  finishes_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  preco_midia numeric NOT NULL DEFAULT 0,
  preco_impressao numeric NOT NULL DEFAULT 0,
  preco_acabamentos numeric NOT NULL DEFAULT 0,
  preco_total numeric NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_cv_quote_items_quote_id ON public.cv_quote_items(quote_id);

ALTER TABLE public.cv_quote_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read cv_quote_items" ON public.cv_quote_items
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert cv_quote_items" ON public.cv_quote_items
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update cv_quote_items" ON public.cv_quote_items
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete cv_quote_items" ON public.cv_quote_items
  FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_cv_quote_items_updated_at
BEFORE UPDATE ON public.cv_quote_items
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();