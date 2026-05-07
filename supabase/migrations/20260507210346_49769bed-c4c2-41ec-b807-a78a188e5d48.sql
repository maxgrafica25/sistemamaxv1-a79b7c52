
ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS default_tax_rate numeric NOT NULL DEFAULT 6,
  ADD COLUMN IF NOT EXISTS default_loss_margin numeric NOT NULL DEFAULT 3;

CREATE TABLE IF NOT EXISTS public.payment_method_fees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  method text NOT NULL UNIQUE,
  fee_pct numeric NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_method_fees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read payment_method_fees"
  ON public.payment_method_fees FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins insert payment_method_fees"
  ON public.payment_method_fees FOR INSERT TO authenticated
  WITH CHECK (is_profile_admin(auth.uid()));

CREATE POLICY "Admins update payment_method_fees"
  ON public.payment_method_fees FOR UPDATE TO authenticated
  USING (is_profile_admin(auth.uid()))
  WITH CHECK (is_profile_admin(auth.uid()));

CREATE POLICY "Admins delete payment_method_fees"
  ON public.payment_method_fees FOR DELETE TO authenticated
  USING (is_profile_admin(auth.uid()));

CREATE TRIGGER trg_payment_method_fees_updated
  BEFORE UPDATE ON public.payment_method_fees
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.payment_method_fees (method, fee_pct, sort_order) VALUES
  ('Pix', 0, 1),
  ('Dinheiro', 0, 2),
  ('Boleto', 2, 3),
  ('Transferência bancária', 0, 4),
  ('Cartão à vista', 3.5, 5),
  ('Cartão 2x', 4, 6),
  ('Cartão 3x', 5, 7),
  ('Cartão 4x', 5.5, 8),
  ('Cartão 5x', 6, 9),
  ('Cartão 6x', 6.5, 10)
ON CONFLICT (method) DO NOTHING;
