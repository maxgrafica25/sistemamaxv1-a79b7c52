
CREATE TABLE public.cv_calc_midias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  tipo_midia text NOT NULL CHECK (tipo_midia IN ('lona','adesivo','chapa','outro')),
  custo_mt2 numeric NOT NULL DEFAULT 0,
  lucro_mt2 numeric NOT NULL DEFAULT 0,
  custo_fixo numeric NOT NULL DEFAULT 0,
  lucro_fixo numeric NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.cv_calc_impressoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  custo_mt2 numeric NOT NULL DEFAULT 0,
  lucro_mt2 numeric NOT NULL DEFAULT 0,
  custo_fixo numeric NOT NULL DEFAULT 0,
  lucro_fixo numeric NOT NULL DEFAULT 0,
  largura_max_cm numeric,
  comprimento_max_cm numeric,
  tipos_midia_compativeis text[] NOT NULL DEFAULT '{}',
  ativo boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.cv_calc_acabamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  familia text NOT NULL CHECK (familia IN (
    'banner_bastao','faixa','bainha_ilhos','ilhos','emenda',
    'laminacao','recorte','refile','outro'
  )),
  tipos_midia_compativeis text[] NOT NULL DEFAULT '{}',
  custo_fixo numeric NOT NULL DEFAULT 0,
  lucro_fixo numeric NOT NULL DEFAULT 0,
  custo_mt2 numeric NOT NULL DEFAULT 0,
  lucro_mt2 numeric NOT NULL DEFAULT 0,
  custo_perimetro numeric NOT NULL DEFAULT 0,
  lucro_perimetro numeric NOT NULL DEFAULT 0,
  custo_unidade numeric NOT NULL DEFAULT 0,
  lucro_unidade numeric NOT NULL DEFAULT 0,
  largura_max_cm numeric,
  ativo boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.cv_calc_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  valor_minimo numeric NOT NULL DEFAULT 35,
  singleton boolean NOT NULL DEFAULT true UNIQUE,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_cv_calc_midias_updated BEFORE UPDATE ON public.cv_calc_midias
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_cv_calc_impressoes_updated BEFORE UPDATE ON public.cv_calc_impressoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_cv_calc_acabamentos_updated BEFORE UPDATE ON public.cv_calc_acabamentos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_cv_calc_config_updated BEFORE UPDATE ON public.cv_calc_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.cv_calc_midias      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cv_calc_impressoes  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cv_calc_acabamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cv_calc_config      ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cv_calc_midias_select" ON public.cv_calc_midias FOR SELECT TO authenticated USING (true);
CREATE POLICY "cv_calc_impressoes_select" ON public.cv_calc_impressoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "cv_calc_acabamentos_select" ON public.cv_calc_acabamentos FOR SELECT TO authenticated USING (true);
CREATE POLICY "cv_calc_config_select" ON public.cv_calc_config FOR SELECT TO authenticated USING (true);

CREATE POLICY "cv_calc_midias_admin_all" ON public.cv_calc_midias FOR ALL TO authenticated
  USING (public.is_profile_admin(auth.uid())) WITH CHECK (public.is_profile_admin(auth.uid()));
CREATE POLICY "cv_calc_impressoes_admin_all" ON public.cv_calc_impressoes FOR ALL TO authenticated
  USING (public.is_profile_admin(auth.uid())) WITH CHECK (public.is_profile_admin(auth.uid()));
CREATE POLICY "cv_calc_acabamentos_admin_all" ON public.cv_calc_acabamentos FOR ALL TO authenticated
  USING (public.is_profile_admin(auth.uid())) WITH CHECK (public.is_profile_admin(auth.uid()));
CREATE POLICY "cv_calc_config_admin_all" ON public.cv_calc_config FOR ALL TO authenticated
  USING (public.is_profile_admin(auth.uid())) WITH CHECK (public.is_profile_admin(auth.uid()));

-- SEED
INSERT INTO public.cv_calc_config (valor_minimo) VALUES (35);

INSERT INTO public.cv_calc_midias (nome, tipo_midia, custo_mt2, lucro_mt2, lucro_fixo, sort_order) VALUES
  ('Adesivo Brilho',                       'adesivo', 13, 0,  8, 10),
  ('Adesivo Fosco',                        'adesivo', 14, 0,  8, 20),
  ('Adesivo Brilho Bloqueado',             'adesivo', 16, 0,  8, 30),
  ('Adesivo Fosco Bloqueado',              'adesivo', 17, 0,  8, 40),
  ('Adesivo Perfurado',                    'adesivo', 25, 0,  8, 50),
  ('Adesivo Transparente',                 'adesivo', 15, 0,  8, 60),
  ('Adesivo Transparente + Fundo Branco',  'adesivo', 28, 0, 10, 70),
  ('Lona Brilho',                          'lona',     9, 0,  8, 80),
  ('Lona Fosca',                           'lona',    10, 0,  8, 90),
  ('Placa PVC 1mm',                        'chapa',   15, 40,10,100),
  ('Placa PVC 2mm',                        'chapa',   19, 48,10,110),
  ('Placa PVC 3mm',                        'chapa',   26, 62,10,120),
  ('Ímã Automotivo',                       'chapa',   35,275,10,130),
  ('Ímã Geladeira',                        'chapa',  155, 75, 0,140),
  ('Papel Couchê 150g',                    'lona',     3,  3, 8,150);

INSERT INTO public.cv_calc_impressoes
  (nome, custo_mt2, lucro_mt2, lucro_fixo, largura_max_cm, comprimento_max_cm, tipos_midia_compativeis, sort_order) VALUES
  ('Impressão Solvente Baixa Resolução', 22.5, 30, 6, 190, 5000, ARRAY['lona','adesivo'],         10),
  ('Impressão Solvente Alta Resolução',  23,   40, 6, 190, 5000, ARRAY['lona','adesivo'],         20),
  ('Impressão Laser Digital',            54,    0, 0, NULL, NULL, ARRAY['adesivo','chapa','outro'],30);

INSERT INTO public.cv_calc_acabamentos
  (nome, familia, tipos_midia_compativeis,
   custo_fixo, lucro_fixo, custo_mt2, lucro_mt2,
   custo_perimetro, lucro_perimetro, custo_unidade, lucro_unidade,
   largura_max_cm, sort_order) VALUES
  ('Refile (Lona)',                                                'refile',       ARRAY['lona'],            5,0, 2,2, 0,0,  0,0, NULL,  10),
  ('Banner (Bastão topo e base até 105cm + Cordinha e Ponteiras)', 'banner_bastao',ARRAY['lona'],            0,0, 4,4, 0,0, 17,14, 105,  20),
  ('Banner (Bastão topo e base até 150cm + Cordinha e Ponteiras)', 'banner_bastao',ARRAY['lona'],            0,0, 4,4, 0,0, 19,16, 150,  30),
  ('Banner (Bastão topo e base até 205cm + Cordinha e Ponteiras)', 'banner_bastao',ARRAY['lona'],            0,0, 4,4, 0,0, 24,20, 205,  40),
  ('Faixa (Bastão nas laterais + Cordinhas e Ponteiras)',          'faixa',        ARRAY['lona'],            0,0, 4,4, 0,0, 21,18, NULL, 50),
  ('Bainha e Ilhós',                                               'bainha_ilhos', ARRAY['lona'],            0,5, 4,4, 2,2,  0,0, NULL, 60),
  ('Bainha, Ilhós e Corda',                                        'bainha_ilhos', ARRAY['lona'],            0,5, 4,4, 3,3,  0,0, NULL, 70),
  ('Ilhós 4 Cantos',                                               'ilhos',        ARRAY['lona'],           10,10,4,4, 0,0,  0,0, NULL, 80),
  ('Emenda',                                                       'emenda',       ARRAY['lona','adesivo'], 70,25,0,0, 0,0,  0,0, NULL, 90),
  ('Laminação (Lona)',                                             'laminacao',    ARRAY['lona'],            0,5,17,22, 0,0,  0,0, NULL,100),
  ('Refile (Adesivo)',                                             'refile',       ARRAY['adesivo'],         5,0, 2,2, 0,0,  0,0, NULL,110),
  ('Recorte Eletrônico + Entregue em Cartelas',                    'recorte',      ARRAY['adesivo'],        15,0,15,15, 0,0.5,0,0, NULL,120),
  ('Recorte Eletrônico + Entregue Individual',                     'recorte',      ARRAY['adesivo'],        30,0,15,15, 1,1, 0,0.05,NULL,130),
  ('Laminação (Adesivo)',                                          'laminacao',    ARRAY['adesivo'],         0,5,15,20, 0,0,  0,0, NULL,140);
