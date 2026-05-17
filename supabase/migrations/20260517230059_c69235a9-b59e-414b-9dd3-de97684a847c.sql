
-- Perguntas do checklist
CREATE TABLE public.quote_checklist_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pergunta text NOT NULL,
  tipo_resposta text NOT NULL CHECK (tipo_resposta IN ('sim_nao','sim_nao_valor','texto','foto')),
  categoria text NOT NULL DEFAULT 'outro',
  hint text,
  ativo boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  -- Para tipo sim_nao_valor: mão de obra a ser auto-adicionada quando "Sim"
  labor_descricao text,
  labor_custo_m2 numeric NOT NULL DEFAULT 0,
  labor_custo_fixo numeric NOT NULL DEFAULT 0,
  labor_step_type text DEFAULT 'outro',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.quote_checklist_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "quote_checklist_questions_select" ON public.quote_checklist_questions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "quote_checklist_questions_admin_all" ON public.quote_checklist_questions
  FOR ALL TO authenticated
  USING (is_profile_admin(auth.uid()))
  WITH CHECK (is_profile_admin(auth.uid()));

-- Gatilhos
CREATE TABLE public.quote_checklist_triggers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES public.quote_checklist_questions(id) ON DELETE CASCADE,
  tipo_midia text[] NOT NULL DEFAULT '{}',
  familia_acab text[] NOT NULL DEFAULT '{}',
  area_min_m2 numeric,
  area_max_m2 numeric,
  altura_min_m numeric,
  sempre boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_qct_question ON public.quote_checklist_triggers(question_id);
ALTER TABLE public.quote_checklist_triggers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "quote_checklist_triggers_select" ON public.quote_checklist_triggers
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "quote_checklist_triggers_admin_all" ON public.quote_checklist_triggers
  FOR ALL TO authenticated
  USING (is_profile_admin(auth.uid()))
  WITH CHECK (is_profile_admin(auth.uid()));

-- Respostas
CREATE TABLE public.quote_checklist_answers (
  quote_id uuid NOT NULL,
  question_id uuid NOT NULL REFERENCES public.quote_checklist_questions(id) ON DELETE CASCADE,
  resposta_bool boolean,
  resposta_num numeric,
  resposta_text text,
  resposta_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (quote_id, question_id)
);

CREATE INDEX idx_qca_quote ON public.quote_checklist_answers(quote_id);
ALTER TABLE public.quote_checklist_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "quote_checklist_answers_all_auth" ON public.quote_checklist_answers
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Triggers de updated_at
CREATE TRIGGER update_qcq_updated_at BEFORE UPDATE ON public.quote_checklist_questions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_qca_updated_at BEFORE UPDATE ON public.quote_checklist_answers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Bucket privado para fotos do checklist
INSERT INTO storage.buckets (id, name, public)
VALUES ('quote-attachments', 'quote-attachments', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "quote_attachments_auth_select" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'quote-attachments');
CREATE POLICY "quote_attachments_auth_insert" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'quote-attachments');
CREATE POLICY "quote_attachments_auth_update" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'quote-attachments');
CREATE POLICY "quote_attachments_auth_delete" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'quote-attachments');

-- Seed das 6 perguntas iniciais
WITH q AS (
  INSERT INTO public.quote_checklist_questions
    (pergunta, tipo_resposta, categoria, hint, sort_order, labor_descricao, labor_custo_m2, labor_step_type)
  VALUES
    ('Necessita desinstalar a lona antiga?', 'sim_nao_valor', 'remocao',
      'Cobrar mão de obra de desinstalação quando o cliente já tem lona instalada.', 10,
      'Desinstalação de lona antiga', 8.00, 'instalacao'),
    ('Precisa retirar o adesivo atual antes da aplicação?', 'sim_nao_valor', 'remocao',
      'Remoção de adesivo aplicado consome tempo considerável.', 20,
      'Remoção de adesivo antigo', 12.00, 'instalacao'),
    ('O local exige andaime ou plataforma elevatória?', 'sim_nao', 'logistica',
      'Aluguel de andaime/PTA precisa entrar no orçamento.', 30, NULL, 0, NULL),
    ('Anexar foto do local de instalação', 'foto', 'logistica',
      'Foto ajuda a equipe a confirmar acesso, altura e necessidade de equipamentos.', 40, NULL, 0, NULL),
    ('O cliente fornece a arte final ou precisa de criação?', 'sim_nao_valor', 'arte',
      'Se for criação, somar mão de obra de design.', 50,
      'Criação de arte', 0, 'arte'),
    ('Há iluminação / back-light atrás da lona?', 'sim_nao', 'instalacao',
      'Influencia escolha de material (block-out vs translúcido).', 60, NULL, 0, NULL)
  RETURNING id, sort_order
)
INSERT INTO public.quote_checklist_triggers (question_id, tipo_midia, area_min_m2, altura_min_m, sempre)
SELECT
  q.id,
  CASE q.sort_order
    WHEN 10 THEN ARRAY['lona']
    WHEN 20 THEN ARRAY['adesivo']
    WHEN 30 THEN ARRAY['lona','adesivo']
    WHEN 40 THEN ARRAY['lona','adesivo']
    WHEN 50 THEN ARRAY[]::text[]
    WHEN 60 THEN ARRAY['lona']
  END,
  CASE q.sort_order WHEN 10 THEN 4 WHEN 20 THEN 3 WHEN 40 THEN 4 ELSE NULL END,
  CASE q.sort_order WHEN 30 THEN 3 ELSE NULL END,
  CASE q.sort_order WHEN 50 THEN true ELSE false END
FROM q;
