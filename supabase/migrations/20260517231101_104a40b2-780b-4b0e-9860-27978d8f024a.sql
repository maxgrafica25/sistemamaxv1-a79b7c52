
CREATE TABLE public.quote_suggestion_rules (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  prioridade integer NOT NULL DEFAULT 0,
  cond_tipo_midia text[] NOT NULL DEFAULT '{}',
  cond_familia text[] NOT NULL DEFAULT '{}',
  cond_area_min numeric,
  cond_area_max numeric,
  cond_altura_min numeric,
  cond_cliente_tag text[] NOT NULL DEFAULT '{}',
  cond_sempre boolean NOT NULL DEFAULT false,
  acao_tipo text NOT NULL CHECK (acao_tipo IN ('sugerir_acabamento','sugerir_pergunta','alerta')),
  acao_acab_id uuid REFERENCES public.cv_calc_acabamentos(id) ON DELETE SET NULL,
  acao_question_id uuid REFERENCES public.quote_checklist_questions(id) ON DELETE SET NULL,
  acao_mensagem text NOT NULL DEFAULT '',
  severidade text NOT NULL DEFAULT 'info' CHECK (severidade IN ('info','aviso','critico')),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.quote_suggestion_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "quote_suggestion_rules_select"
  ON public.quote_suggestion_rules FOR SELECT TO authenticated USING (true);

CREATE POLICY "quote_suggestion_rules_admin_all"
  ON public.quote_suggestion_rules FOR ALL TO authenticated
  USING (is_profile_admin(auth.uid()))
  WITH CHECK (is_profile_admin(auth.uid()));

CREATE TRIGGER trg_quote_suggestion_rules_updated_at
  BEFORE UPDATE ON public.quote_suggestion_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_quote_suggestion_rules_ativo ON public.quote_suggestion_rules(ativo, prioridade);
