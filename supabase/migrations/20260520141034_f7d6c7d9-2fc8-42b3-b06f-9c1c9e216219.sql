-- Tabela de variantes por faixa para itens de kit (ex.: espiral por nº de folhas)
CREATE TABLE public.product_kit_item_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.product_kit_items(id) ON DELETE CASCADE,
  min_value numeric NOT NULL DEFAULT 0,
  max_value numeric, -- null = sem limite superior
  supply_id uuid REFERENCES public.supplies(id) ON DELETE SET NULL,
  label text,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_pkiv_item ON public.product_kit_item_variants(item_id);

ALTER TABLE public.product_kit_item_variants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kit variants readable by authenticated"
  ON public.product_kit_item_variants FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "kit variants insert by admin"
  ON public.product_kit_item_variants FOR INSERT
  TO authenticated WITH CHECK (public.is_profile_admin(auth.uid()));

CREATE POLICY "kit variants update by admin"
  ON public.product_kit_item_variants FOR UPDATE
  TO authenticated USING (public.is_profile_admin(auth.uid()))
  WITH CHECK (public.is_profile_admin(auth.uid()));

CREATE POLICY "kit variants delete by admin"
  ON public.product_kit_item_variants FOR DELETE
  TO authenticated USING (public.is_profile_admin(auth.uid()));