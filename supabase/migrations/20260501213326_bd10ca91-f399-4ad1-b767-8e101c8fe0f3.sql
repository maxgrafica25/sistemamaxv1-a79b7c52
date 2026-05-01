-- Tabela de Acabamentos (Recorte plotter, Laminação, Verniz, etc.)
CREATE TABLE public.finishings_price_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'recorte',
  size text NOT NULL,
  price_per_sheet numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.finishings_price_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read finishings_price_items"
ON public.finishings_price_items FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert finishings_price_items"
ON public.finishings_price_items FOR INSERT TO authenticated
WITH CHECK (is_profile_admin(auth.uid()));

CREATE POLICY "Admins can update finishings_price_items"
ON public.finishings_price_items FOR UPDATE TO authenticated
USING (is_profile_admin(auth.uid()))
WITH CHECK (is_profile_admin(auth.uid()));

CREATE POLICY "Admins can delete finishings_price_items"
ON public.finishings_price_items FOR DELETE TO authenticated
USING (is_profile_admin(auth.uid()));

CREATE TRIGGER update_finishings_price_items_updated_at
BEFORE UPDATE ON public.finishings_price_items
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_finishings_price_items_size_active
ON public.finishings_price_items (size, is_active);

-- Seeds para SRA3 (preço a ser preenchido pelo admin)
INSERT INTO public.finishings_price_items (name, category, size, price_per_sheet, sort_order) VALUES
  ('Recorte plotter quadrado', 'recorte', 'SRA3', 0, 0),
  ('Recorte plotter redondo', 'recorte', 'SRA3', 0, 1);