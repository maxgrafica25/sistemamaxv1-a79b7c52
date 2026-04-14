
CREATE TABLE public.global_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_pct numeric NOT NULL DEFAULT 10,
  collection_pct numeric NOT NULL DEFAULT 7,
  waste_pct numeric NOT NULL DEFAULT 5,
  default_margin_pct numeric NOT NULL DEFAULT 33,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.global_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read global_settings"
  ON public.global_settings FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated can update global_settings"
  ON public.global_settings FOR UPDATE
  TO authenticated USING (true);

CREATE POLICY "Authenticated can insert global_settings"
  ON public.global_settings FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE TRIGGER update_global_settings_updated_at
  BEFORE UPDATE ON public.global_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.global_settings (invoice_pct, collection_pct, waste_pct, default_margin_pct)
VALUES (10, 7, 5, 33);
