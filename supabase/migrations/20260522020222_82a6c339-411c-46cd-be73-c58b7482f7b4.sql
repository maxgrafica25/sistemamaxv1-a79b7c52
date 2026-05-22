
CREATE TABLE public.quote_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  icone text NOT NULL DEFAULT 'Wand2',
  modulo text NOT NULL CHECK (modulo IN ('cv','impressao','ambos')),
  form_tipo text CHECK (form_tipo IN ('print','booklet','label')),
  ordem integer NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  largura_cm numeric,
  altura_cm numeric,
  quantidade_padrao integer,
  is_banner boolean NOT NULL DEFAULT false,
  midia_tipo text CHECK (midia_tipo IN ('lona','adesivo','chapa')),
  midia_nome_match text,
  papel_inclui text[] NOT NULL DEFAULT '{}',
  papel_exclui text[] NOT NULL DEFAULT '{}',
  acabamentos_sugeridos text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.quote_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read quote_presets"
  ON public.quote_presets FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert quote_presets"
  ON public.quote_presets FOR INSERT TO authenticated
  WITH CHECK (public.is_profile_admin(auth.uid()));

CREATE POLICY "Admins can update quote_presets"
  ON public.quote_presets FOR UPDATE TO authenticated
  USING (public.is_profile_admin(auth.uid()))
  WITH CHECK (public.is_profile_admin(auth.uid()));

CREATE POLICY "Admins can delete quote_presets"
  ON public.quote_presets FOR DELETE TO authenticated
  USING (public.is_profile_admin(auth.uid()));

CREATE TRIGGER update_quote_presets_updated_at
  BEFORE UPDATE ON public.quote_presets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed com os presets atuais
INSERT INTO public.quote_presets (nome, icone, modulo, form_tipo, ordem, largura_cm, altura_cm, quantidade_padrao, is_banner, midia_tipo, midia_nome_match, papel_inclui, acabamentos_sugeridos) VALUES
  ('Banner',  'Megaphone', 'cv',        NULL,      10, 100, 70,  1,    true,  'lona',    'brilho 440', '{}', '{}'),
  ('Lona',    'Megaphone', 'cv',        NULL,      20, 200, 100, 1,    false, 'lona',    NULL,         '{}', '{}'),
  ('Adesivo', 'Megaphone', 'cv',        NULL,      30, 30,  30,  10,   false, 'adesivo', NULL,         '{}', '{}'),
  ('Faixa',   'Megaphone', 'cv',        NULL,      40, 200, 50,  1,    true,  'lona',    'brilho 440', '{}', '{}'),
  ('Folheto / Flyer',   'FileText',   'impressao', 'print',   10, NULL, NULL, 1000, false, NULL, NULL, ARRAY['couchê','couche','offset'], '{}'),
  ('Cartão de Visita',  'CreditCard', 'impressao', 'print',   20, NULL, NULL, 1000, false, NULL, NULL, ARRAY['couchê 250','couche 250','supremo','triplex'], ARRAY['laminacao','verniz']),
  ('Apostila',          'BookOpen',   'impressao', 'booklet', 30, NULL, NULL, NULL, false, NULL, NULL, '{}', '{}'),
  ('Etiqueta',          'Tag',        'impressao', 'label',   40, NULL, NULL, NULL, false, NULL, NULL, '{}', '{}'),
  ('Adesivo',           'Sticker',    'impressao', 'print',   50, NULL, NULL, 100,  false, NULL, NULL, ARRAY['adesivo','vinil'], '{}');
