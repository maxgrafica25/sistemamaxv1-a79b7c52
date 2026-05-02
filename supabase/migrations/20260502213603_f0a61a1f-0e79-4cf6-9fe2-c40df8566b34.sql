
-- Tabela de faixas de preço por quantidade de folhas para acabamentos
CREATE TABLE public.finishing_price_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  finishing_id uuid NOT NULL REFERENCES public.finishings_price_items(id) ON DELETE CASCADE,
  label text NOT NULL,
  min_qty integer NOT NULL CHECK (min_qty >= 1),
  max_qty integer NULL,
  price_per_sheet numeric NOT NULL CHECK (price_per_sheet >= 0),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_finishing_price_tiers_finishing
  ON public.finishing_price_tiers(finishing_id, min_qty);

ALTER TABLE public.finishing_price_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read finishing_price_tiers"
  ON public.finishing_price_tiers FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins can insert finishing_price_tiers"
  ON public.finishing_price_tiers FOR INSERT
  TO authenticated WITH CHECK (is_profile_admin(auth.uid()));

CREATE POLICY "Admins can update finishing_price_tiers"
  ON public.finishing_price_tiers FOR UPDATE
  TO authenticated USING (is_profile_admin(auth.uid()))
  WITH CHECK (is_profile_admin(auth.uid()));

CREATE POLICY "Admins can delete finishing_price_tiers"
  ON public.finishing_price_tiers FOR DELETE
  TO authenticated USING (is_profile_admin(auth.uid()));

-- Trigger de validação: max_qty NULL OU >= min_qty + sem sobreposição entre faixas do mesmo finishing
CREATE OR REPLACE FUNCTION public.validate_finishing_price_tier()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.max_qty IS NOT NULL AND NEW.max_qty < NEW.min_qty THEN
    RAISE EXCEPTION 'max_qty (%) deve ser >= min_qty (%)', NEW.max_qty, NEW.min_qty;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.finishing_price_tiers t
    WHERE t.finishing_id = NEW.finishing_id
      AND t.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND NEW.min_qty <= COALESCE(t.max_qty, 2147483647)
      AND COALESCE(NEW.max_qty, 2147483647) >= t.min_qty
  ) THEN
    RAISE EXCEPTION 'Faixa de quantidade sobreposta a outra existente para este acabamento';
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_finishing_price_tier
BEFORE INSERT OR UPDATE ON public.finishing_price_tiers
FOR EACH ROW EXECUTE FUNCTION public.validate_finishing_price_tier();

-- Seed: para cada acabamento existente, cria faixa única {min:1, max:NULL, price=base}
INSERT INTO public.finishing_price_tiers (finishing_id, label, min_qty, max_qty, price_per_sheet, sort_order)
SELECT id, '1+', 1, NULL, price_per_sheet, 0
FROM public.finishings_price_items;
