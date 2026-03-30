
-- Create clients table
CREATE TABLE public.clients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  telefone TEXT NOT NULL,
  empresa TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to clients" ON public.clients FOR ALL USING (true) WITH CHECK (true);

-- Create suppliers table
CREATE TABLE public.suppliers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  telefone TEXT NOT NULL,
  cnpj TEXT,
  endereco TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to suppliers" ON public.suppliers FOR ALL USING (true) WITH CHECK (true);

-- Create production_steps table
CREATE TABLE public.production_steps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  description TEXT NOT NULL,
  time_minutes NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.production_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to production_steps" ON public.production_steps FOR ALL USING (true) WITH CHECK (true);

-- Create step_groups table
CREATE TABLE public.step_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.step_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to step_groups" ON public.step_groups FOR ALL USING (true) WITH CHECK (true);

-- Create step_group_items table
CREATE TABLE public.step_group_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  step_group_id UUID NOT NULL REFERENCES public.step_groups(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  time_minutes NUMERIC NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.step_group_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to step_group_items" ON public.step_group_items FOR ALL USING (true) WITH CHECK (true);

-- Create quotes table
CREATE TABLE public.quotes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_number TEXT NOT NULL,
  client TEXT NOT NULL,
  product TEXT NOT NULL,
  value NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  rejection_reason TEXT,
  validity TEXT,
  profit_margin TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to quotes" ON public.quotes FOR ALL USING (true) WITH CHECK (true);

-- Create quote_labor_steps table
CREATE TABLE public.quote_labor_steps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  time_minutes NUMERIC NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0
);
ALTER TABLE public.quote_labor_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to quote_labor_steps" ON public.quote_labor_steps FOR ALL USING (true) WITH CHECK (true);

-- Create quote_materials table
CREATE TABLE public.quote_materials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 0,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0
);
ALTER TABLE public.quote_materials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to quote_materials" ON public.quote_materials FOR ALL USING (true) WITH CHECK (true);

-- Create quote_third_party table
CREATE TABLE public.quote_third_party (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  supplier TEXT NOT NULL DEFAULT '',
  cost NUMERIC NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0
);
ALTER TABLE public.quote_third_party ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to quote_third_party" ON public.quote_third_party FOR ALL USING (true) WITH CHECK (true);

-- Create printer_readings table
CREATE TABLE public.printer_readings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  printer_model TEXT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  counter INTEGER NOT NULL DEFAULT 0,
  color_prints INTEGER,
  bw_prints INTEGER,
  total_prints INTEGER,
  type TEXT NOT NULL DEFAULT 'daily',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.printer_readings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to printer_readings" ON public.printer_readings FOR ALL USING (true) WITH CHECK (true);

-- Create supplies table
CREATE TABLE public.supplies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  produto TEXT NOT NULL,
  finalidade TEXT NOT NULL DEFAULT '',
  quantidade NUMERIC NOT NULL DEFAULT 0,
  valor NUMERIC NOT NULL DEFAULT 0,
  fornecedor TEXT NOT NULL DEFAULT '',
  valor_unitario NUMERIC NOT NULL DEFAULT 0,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  contato TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.supplies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to supplies" ON public.supplies FOR ALL USING (true) WITH CHECK (true);

-- Create supply_purchase_history table
CREATE TABLE public.supply_purchase_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  supply_id UUID NOT NULL REFERENCES public.supplies(id) ON DELETE CASCADE,
  produto TEXT NOT NULL,
  quantidade NUMERIC NOT NULL DEFAULT 0,
  valor NUMERIC NOT NULL DEFAULT 0,
  valor_unitario NUMERIC NOT NULL DEFAULT 0,
  fornecedor TEXT NOT NULL DEFAULT '',
  contato TEXT NOT NULL DEFAULT '',
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.supply_purchase_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to supply_purchase_history" ON public.supply_purchase_history FOR ALL USING (true) WITH CHECK (true);

-- Create update trigger function if not exists
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Add update triggers
CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_production_steps_updated_at BEFORE UPDATE ON public.production_steps FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_step_groups_updated_at BEFORE UPDATE ON public.step_groups FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_quotes_updated_at BEFORE UPDATE ON public.quotes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_supplies_updated_at BEFORE UPDATE ON public.supplies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
