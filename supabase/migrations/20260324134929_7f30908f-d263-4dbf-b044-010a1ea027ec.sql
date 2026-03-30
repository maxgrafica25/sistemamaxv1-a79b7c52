
-- Recreate equipments table
CREATE TABLE public.equipments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.equipments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to equipments" ON public.equipments FOR ALL USING (true) WITH CHECK (true);

-- Recreate equipment_consumables table
CREATE TABLE public.equipment_consumables (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  equipment_id UUID NOT NULL REFERENCES public.equipments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price NUMERIC NOT NULL DEFAULT 0,
  yield_pages INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.equipment_consumables ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to equipment_consumables" ON public.equipment_consumables FOR ALL USING (true) WITH CHECK (true);

-- Recreate papers table
CREATE TABLE public.papers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  grammage TEXT,
  sheet_qty INTEGER NOT NULL DEFAULT 0,
  pack_price NUMERIC NOT NULL DEFAULT 0,
  freight_price NUMERIC NOT NULL DEFAULT 0,
  supplier TEXT,
  contact TEXT,
  quote_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.papers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to papers" ON public.papers FOR ALL USING (true) WITH CHECK (true);

-- Recreate paper_price_history table
CREATE TABLE public.paper_price_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  paper_id UUID NOT NULL REFERENCES public.papers(id) ON DELETE CASCADE,
  sheet_qty INTEGER NOT NULL DEFAULT 0,
  pack_price NUMERIC NOT NULL DEFAULT 0,
  freight_price NUMERIC NOT NULL DEFAULT 0,
  supplier TEXT,
  contact TEXT,
  quote_date DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.paper_price_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to paper_price_history" ON public.paper_price_history FOR ALL USING (true) WITH CHECK (true);

-- Recreate monthly_expenses table
CREATE TABLE public.monthly_expenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  value NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.monthly_expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to monthly_expenses" ON public.monthly_expenses FOR ALL USING (true) WITH CHECK (true);

-- Recreate salaries table
CREATE TABLE public.salaries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  salary NUMERIC NOT NULL DEFAULT 0,
  is_production BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.salaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to salaries" ON public.salaries FOR ALL USING (true) WITH CHECK (true);

-- Recreate equipment_depreciation table
CREATE TABLE public.equipment_depreciation (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  purchase_value NUMERIC NOT NULL DEFAULT 0,
  useful_life_months INTEGER NOT NULL DEFAULT 60,
  residual_value NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.equipment_depreciation ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to equipment_depreciation" ON public.equipment_depreciation FOR ALL USING (true) WITH CHECK (true);

-- Recreate productive_capacity table
CREATE TABLE public.productive_capacity (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  production_employees INTEGER NOT NULL DEFAULT 0,
  hours_per_month NUMERIC NOT NULL DEFAULT 147,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.productive_capacity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to productive_capacity" ON public.productive_capacity FOR ALL USING (true) WITH CHECK (true);

-- Insert default productive_capacity row
INSERT INTO public.productive_capacity (production_employees, hours_per_month) VALUES (0, 147);

-- Recreate printer_categories table
CREATE TABLE public.printer_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.printer_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to printer_categories" ON public.printer_categories FOR ALL USING (true) WITH CHECK (true);

-- Recreate markup_tiers table
CREATE TABLE public.markup_tiers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  printer_category_id UUID NOT NULL REFERENCES public.printer_categories(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  min_qty INTEGER NOT NULL DEFAULT 1,
  max_qty INTEGER,
  fixed_cost_pct NUMERIC NOT NULL DEFAULT 40,
  variable_cost_pct NUMERIC NOT NULL DEFAULT 13,
  margin_pct NUMERIC NOT NULL DEFAULT 33,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.markup_tiers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to markup_tiers" ON public.markup_tiers FOR ALL USING (true) WITH CHECK (true);

-- Recreate printing_price_items table
CREATE TABLE public.printing_price_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  printer_category_id UUID NOT NULL REFERENCES public.printer_categories(id) ON DELETE CASCADE,
  code TEXT,
  paper_type TEXT NOT NULL,
  grammage TEXT,
  size TEXT NOT NULL DEFAULT 'A4',
  side TEXT NOT NULL DEFAULT 'F',
  paper_cost NUMERIC NOT NULL DEFAULT 0,
  printing_cost NUMERIC NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  equipment_id UUID REFERENCES public.equipments(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.printing_price_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to printing_price_items" ON public.printing_price_items FOR ALL USING (true) WITH CHECK (true);

-- Add update triggers for new tables
CREATE TRIGGER update_equipments_updated_at BEFORE UPDATE ON public.equipments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_equipment_consumables_updated_at BEFORE UPDATE ON public.equipment_consumables FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_papers_updated_at BEFORE UPDATE ON public.papers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_monthly_expenses_updated_at BEFORE UPDATE ON public.monthly_expenses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_salaries_updated_at BEFORE UPDATE ON public.salaries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_equipment_depreciation_updated_at BEFORE UPDATE ON public.equipment_depreciation FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_productive_capacity_updated_at BEFORE UPDATE ON public.productive_capacity FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_printer_categories_updated_at BEFORE UPDATE ON public.printer_categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_markup_tiers_updated_at BEFORE UPDATE ON public.markup_tiers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_printing_price_items_updated_at BEFORE UPDATE ON public.printing_price_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
