
-- Printer categories (e.g., Laser Color, Laser PB, Workforce, Inkjet, Fargo)
CREATE TABLE public.printer_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.printer_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on printer_categories" ON public.printer_categories FOR ALL USING (true) WITH CHECK (true);

-- Markup tiers per printer category (quantity ranges with cost breakdown)
CREATE TABLE public.markup_tiers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  printer_category_id UUID NOT NULL REFERENCES public.printer_categories(id) ON DELETE CASCADE,
  label TEXT NOT NULL, -- e.g. "01-10", "11-50"
  min_qty INTEGER NOT NULL DEFAULT 1,
  max_qty INTEGER, -- NULL means unlimited (e.g. "500+")
  fixed_cost_pct NUMERIC NOT NULL DEFAULT 40,
  variable_cost_pct NUMERIC NOT NULL DEFAULT 13,
  margin_pct NUMERIC NOT NULL DEFAULT 33,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.markup_tiers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on markup_tiers" ON public.markup_tiers FOR ALL USING (true) WITH CHECK (true);

-- Paper printing items (paper + printing cost per item)
CREATE TABLE public.printing_price_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  printer_category_id UUID NOT NULL REFERENCES public.printer_categories(id) ON DELETE CASCADE,
  code TEXT, -- e.g. "154", "231"
  paper_type TEXT NOT NULL, -- Sulfite, Reciclato, Cartolina, etc.
  grammage TEXT, -- 75g, 180g, 240g, etc.
  size TEXT NOT NULL DEFAULT 'A4', -- A4, A3
  side TEXT NOT NULL DEFAULT 'F', -- F (Frente), F/V (Frente e Verso)
  paper_cost NUMERIC NOT NULL DEFAULT 0,
  printing_cost NUMERIC NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.printing_price_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on printing_price_items" ON public.printing_price_items FOR ALL USING (true) WITH CHECK (true);

-- Create indexes
CREATE INDEX idx_printing_price_items_category ON public.printing_price_items(printer_category_id);
CREATE INDEX idx_markup_tiers_category ON public.markup_tiers(printer_category_id);
