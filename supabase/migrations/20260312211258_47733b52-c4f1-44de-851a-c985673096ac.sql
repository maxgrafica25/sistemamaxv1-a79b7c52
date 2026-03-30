
-- Despesas mensais fixas
CREATE TABLE public.monthly_expenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  value NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Salários (funcionários de produção e outros)
CREATE TABLE public.salaries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  salary NUMERIC(12,2) NOT NULL DEFAULT 0,
  is_production BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Depreciação de equipamentos
CREATE TABLE public.equipment_depreciation (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  purchase_value NUMERIC(12,2) NOT NULL DEFAULT 0,
  useful_life_months INTEGER NOT NULL DEFAULT 60,
  residual_value NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Configuração de capacidade produtiva
CREATE TABLE public.productive_capacity (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  production_employees INTEGER NOT NULL DEFAULT 1,
  working_days_per_month INTEGER NOT NULL DEFAULT 22,
  hours_per_day NUMERIC(4,1) NOT NULL DEFAULT 8,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.monthly_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_depreciation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.productive_capacity ENABLE ROW LEVEL SECURITY;

-- Permissive policies (no auth yet)
CREATE POLICY "Allow all" ON public.monthly_expenses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON public.salaries FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON public.equipment_depreciation FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON public.productive_capacity FOR ALL USING (true) WITH CHECK (true);

-- Timestamp trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_monthly_expenses_updated_at BEFORE UPDATE ON public.monthly_expenses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_salaries_updated_at BEFORE UPDATE ON public.salaries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_equipment_depreciation_updated_at BEFORE UPDATE ON public.equipment_depreciation FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_productive_capacity_updated_at BEFORE UPDATE ON public.productive_capacity FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default capacity row
INSERT INTO public.productive_capacity (production_employees, working_days_per_month, hours_per_day) VALUES (5, 22, 8);
