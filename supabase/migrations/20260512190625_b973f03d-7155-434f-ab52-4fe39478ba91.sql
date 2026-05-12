CREATE TABLE public.supply_pricing_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supply_id uuid NOT NULL REFERENCES public.supplies(id) ON DELETE CASCADE,
  label text NOT NULL,
  min_qty integer NOT NULL CHECK (min_qty >= 1),
  max_qty integer CHECK (max_qty IS NULL OR max_qty >= min_qty),
  manual_price numeric NOT NULL CHECK (manual_price >= 0),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_supply_pricing_tiers_supply ON public.supply_pricing_tiers (supply_id, min_qty);

ALTER TABLE public.supply_pricing_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read supply_pricing_tiers"
  ON public.supply_pricing_tiers FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins insert supply_pricing_tiers"
  ON public.supply_pricing_tiers FOR INSERT TO authenticated
  WITH CHECK (is_profile_admin(auth.uid()));

CREATE POLICY "Admins update supply_pricing_tiers"
  ON public.supply_pricing_tiers FOR UPDATE TO authenticated
  USING (is_profile_admin(auth.uid()))
  WITH CHECK (is_profile_admin(auth.uid()));

CREATE POLICY "Admins delete supply_pricing_tiers"
  ON public.supply_pricing_tiers FOR DELETE TO authenticated
  USING (is_profile_admin(auth.uid()));

CREATE TRIGGER update_supply_pricing_tiers_updated_at
  BEFORE UPDATE ON public.supply_pricing_tiers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.check_supply_tier_overlap()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.supply_pricing_tiers t
    WHERE t.supply_id = NEW.supply_id
      AND t.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND NEW.min_qty <= COALESCE(t.max_qty, 2147483647)
      AND COALESCE(NEW.max_qty, 2147483647) >= t.min_qty
  ) THEN
    RAISE EXCEPTION 'Faixa de quantidade sobrepõe outra faixa existente para este suprimento';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER supply_pricing_tiers_no_overlap
  BEFORE INSERT OR UPDATE ON public.supply_pricing_tiers
  FOR EACH ROW EXECUTE FUNCTION public.check_supply_tier_overlap();