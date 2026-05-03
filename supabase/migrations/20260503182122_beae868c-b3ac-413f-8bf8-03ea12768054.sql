
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS attention_to text,
  ADD COLUMN IF NOT EXISTS hidden_extras_value numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS freight_value numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS freight_type_id uuid,
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS public.freight_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  default_value numeric NOT NULL DEFAULT 0,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.freight_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read freight_types"
  ON public.freight_types FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins insert freight_types"
  ON public.freight_types FOR INSERT TO authenticated
  WITH CHECK (is_profile_admin(auth.uid()));

CREATE POLICY "Admins update freight_types"
  ON public.freight_types FOR UPDATE TO authenticated
  USING (is_profile_admin(auth.uid())) WITH CHECK (is_profile_admin(auth.uid()));

CREATE POLICY "Admins delete freight_types"
  ON public.freight_types FOR DELETE TO authenticated
  USING (is_profile_admin(auth.uid()));

CREATE TRIGGER update_freight_types_updated_at
  BEFORE UPDATE ON public.freight_types
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.freight_types (name, default_value, sort_order) VALUES
  ('Retirada', 0, 0),
  ('Moto', 0, 1),
  ('Correios', 0, 2),
  ('Transportadora', 0, 3)
ON CONFLICT (name) DO NOTHING;
