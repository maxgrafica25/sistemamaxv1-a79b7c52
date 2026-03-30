
-- Equipment registry
CREATE TABLE public.equipments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.equipments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on equipments" ON public.equipments FOR ALL USING (true) WITH CHECK (true);

-- Equipment consumables (toner, developer, cylinder, belt, fuser, maintenance, depreciation)
CREATE TABLE public.equipment_consumables (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  equipment_id UUID NOT NULL REFERENCES public.equipments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price NUMERIC NOT NULL DEFAULT 0,
  yield_pages INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.equipment_consumables ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on equipment_consumables" ON public.equipment_consumables FOR ALL USING (true) WITH CHECK (true);

-- Add equipment_id to printing_price_items to link paper items to equipment for printing cost
ALTER TABLE public.printing_price_items ADD COLUMN equipment_id UUID REFERENCES public.equipments(id) ON DELETE SET NULL;
