-- Tabela singleton de configurações da empresa
CREATE TABLE IF NOT EXISTS public.company_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_name text NOT NULL DEFAULT '',
  whatsapp_number text NOT NULL DEFAULT '',
  whatsapp_display text,
  email text,
  address text,
  logo_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

-- SELECT aberto inclusive para anon (usado pelo /view-quote/:id público)
CREATE POLICY "Anyone can read company_settings"
ON public.company_settings
FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Admins can insert company_settings"
ON public.company_settings
FOR INSERT
TO authenticated
WITH CHECK (is_profile_admin(auth.uid()));

CREATE POLICY "Admins can update company_settings"
ON public.company_settings
FOR UPDATE
TO authenticated
USING (is_profile_admin(auth.uid()))
WITH CHECK (is_profile_admin(auth.uid()));

CREATE TRIGGER update_company_settings_updated_at
BEFORE UPDATE ON public.company_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Seed do singleton
INSERT INTO public.company_settings (company_name, whatsapp_number)
SELECT 'Max Gráfica', ''
WHERE NOT EXISTS (SELECT 1 FROM public.company_settings);