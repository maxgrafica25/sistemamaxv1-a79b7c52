
-- 1. Create markup_groups table
CREATE TABLE public.markup_groups (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.markup_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read markup_groups" ON public.markup_groups FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert markup_groups" ON public.markup_groups FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update markup_groups" ON public.markup_groups FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete markup_groups" ON public.markup_groups FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_markup_groups_updated_at
  BEFORE UPDATE ON public.markup_groups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Add default_markup_group_id to printer_categories
ALTER TABLE public.printer_categories
  ADD COLUMN default_markup_group_id uuid REFERENCES public.markup_groups(id) ON DELETE SET NULL;

-- 3. Add markup_group_id to markup_tiers
ALTER TABLE public.markup_tiers
  ADD COLUMN markup_group_id uuid REFERENCES public.markup_groups(id) ON DELETE CASCADE;

-- 4. Add markup_group_id to printing_price_items (optional override)
ALTER TABLE public.printing_price_items
  ADD COLUMN markup_group_id uuid REFERENCES public.markup_groups(id) ON DELETE SET NULL;

-- 5. Migrate existing data: create one group per category, link tiers
DO $$
DECLARE
  cat RECORD;
  new_group_id uuid;
BEGIN
  FOR cat IN SELECT id, name FROM public.printer_categories LOOP
    INSERT INTO public.markup_groups (name) VALUES (cat.name || ' - Padrão') RETURNING id INTO new_group_id;
    UPDATE public.printer_categories SET default_markup_group_id = new_group_id WHERE id = cat.id;
    UPDATE public.markup_tiers SET markup_group_id = new_group_id WHERE printer_category_id = cat.id;
  END LOOP;
END $$;
