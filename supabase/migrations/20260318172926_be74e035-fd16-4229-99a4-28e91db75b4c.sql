
-- Papers registry table
CREATE TABLE public.papers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  grammage TEXT,
  sheet_qty INTEGER NOT NULL DEFAULT 1,
  pack_price NUMERIC NOT NULL DEFAULT 0,
  freight_price NUMERIC NOT NULL DEFAULT 0,
  supplier TEXT,
  contact TEXT,
  quote_date DATE DEFAULT CURRENT_DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Paper price history table
CREATE TABLE public.paper_price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paper_id UUID REFERENCES public.papers(id) ON DELETE CASCADE NOT NULL,
  sheet_qty INTEGER NOT NULL,
  pack_price NUMERIC NOT NULL,
  freight_price NUMERIC NOT NULL DEFAULT 0,
  supplier TEXT,
  contact TEXT,
  quote_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Triggers for updated_at
CREATE TRIGGER update_papers_updated_at
  BEFORE UPDATE ON public.papers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Disable RLS (no auth yet)
ALTER TABLE public.papers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paper_price_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on papers" ON public.papers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on paper_price_history" ON public.paper_price_history FOR ALL USING (true) WITH CHECK (true);
