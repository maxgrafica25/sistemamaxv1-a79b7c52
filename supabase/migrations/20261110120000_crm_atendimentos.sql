-- CRM de atendimento (fase 1, decidido com o Juliano em 10/11/2026).
-- Cada atendimento é um cartão ligado a um cliente do cadastro (public.clients) e anda pelas
-- etapas do quadro (kanban). Clientes ganham etiquetas com cor ("Recorrente", "Prioridade"...).
-- A fila é calculada na tela: quem espera resposta há mais tempo fica em cima; etiqueta de
-- prioridade passa na frente. Retorno (follow-up) = data + anotação no cartão.
-- Atalhos = mensagens prontas com {nome}, {pedido}... enviadas pelo WhatsApp Web (sem custo).
-- Nesta fase nada vem de fora: as mensagens dos canais entram na fase 3.

CREATE TABLE public.crm_etiquetas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL DEFAULT public.current_empresa_id() REFERENCES public.empresas(id) ON DELETE RESTRICT,
  nome text NOT NULL CHECK (length(btrim(nome)) > 0),
  cor text NOT NULL DEFAULT '#64748b' CHECK (cor ~ '^#[0-9a-fA-F]{6}$'),
  prioridade boolean NOT NULL DEFAULT false,   -- clientes com esta etiqueta passam na frente na fila
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX crm_etiquetas_empresa_nome_key ON public.crm_etiquetas (empresa_id, lower(btrim(nome)));

CREATE TABLE public.client_etiquetas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL DEFAULT public.current_empresa_id() REFERENCES public.empresas(id) ON DELETE RESTRICT,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  etiqueta_id uuid NOT NULL REFERENCES public.crm_etiquetas(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, etiqueta_id)
);
CREATE INDEX idx_client_etiquetas_empresa_id ON public.client_etiquetas (empresa_id);
CREATE INDEX idx_client_etiquetas_etiqueta_id ON public.client_etiquetas (etiqueta_id);

CREATE TABLE public.crm_etapas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL DEFAULT public.current_empresa_id() REFERENCES public.empresas(id) ON DELETE RESTRICT,
  nome text NOT NULL CHECK (length(btrim(nome)) > 0),
  cor text NOT NULL DEFAULT '#64748b' CHECK (cor ~ '^#[0-9a-fA-F]{6}$'),
  sort_order int NOT NULL DEFAULT 0,
  is_final boolean NOT NULL DEFAULT false,     -- etapa de encerramento: o cartão sai da fila de espera
  retorno_auto_dias int CHECK (retorno_auto_dias IS NULL OR retorno_auto_dias BETWEEN 1 AND 365),
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_crm_etapas_empresa_id ON public.crm_etapas (empresa_id);

CREATE TABLE public.atendimentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL DEFAULT public.current_empresa_id() REFERENCES public.empresas(id) ON DELETE RESTRICT,
  client_id uuid REFERENCES public.clients(id) ON DELETE RESTRICT,  -- nulo = contato ainda não cadastrado (fase 3)
  contato_nome text,                             -- nome mostrado quando não há cliente vinculado
  titulo text NOT NULL DEFAULT '',
  etapa_id uuid NOT NULL REFERENCES public.crm_etapas(id) ON DELETE RESTRICT,
  canal text NOT NULL DEFAULT 'whatsapp' CHECK (canal IN ('whatsapp', 'instagram', 'email', 'balcao', 'telefone', 'outro')),
  responsavel_id uuid,                           -- auth.users.id (profiles.user_id)
  quote_id uuid REFERENCES public.quotes(id) ON DELETE SET NULL,
  sales_order_id uuid REFERENCES public.sales_orders(id) ON DELETE SET NULL,
  aguardando_desde timestamptz,                  -- cliente esperando resposta desde (nulo = respondido)
  retorno_em timestamptz,                        -- follow-up marcado
  retorno_nota text,
  ultima_atividade_em timestamptz NOT NULL DEFAULT now(),
  arquivado_em timestamptz,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_atendimentos_empresa_ativos ON public.atendimentos (empresa_id) WHERE arquivado_em IS NULL;
CREATE INDEX idx_atendimentos_client_id ON public.atendimentos (client_id);
CREATE INDEX idx_atendimentos_etapa_id ON public.atendimentos (etapa_id);

CREATE TABLE public.atendimento_mensagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL DEFAULT public.current_empresa_id() REFERENCES public.empresas(id) ON DELETE RESTRICT,
  atendimento_id uuid NOT NULL REFERENCES public.atendimentos(id) ON DELETE CASCADE,
  -- nota = anotação interna; equipe = enviada ao cliente; cliente = recebida; sistema = histórico automático
  tipo text NOT NULL DEFAULT 'nota' CHECK (tipo IN ('nota', 'equipe', 'cliente', 'sistema')),
  conteudo text NOT NULL DEFAULT '',
  anexo_path text,                               -- caminho no bucket atendimento-anexos (o link é gerado ao abrir)
  anexo_nome text,
  user_id uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_atendimento_mensagens_atendimento ON public.atendimento_mensagens (atendimento_id, created_at);
CREATE INDEX idx_atendimento_mensagens_empresa_id ON public.atendimento_mensagens (empresa_id);

CREATE TABLE public.crm_modelos_mensagem (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL DEFAULT public.current_empresa_id() REFERENCES public.empresas(id) ON DELETE RESTRICT,
  atalho text NOT NULL CHECK (atalho ~ '^[a-z0-9_-]{1,30}$'),   -- digitado depois da barra: /pronto
  titulo text NOT NULL CHECK (length(btrim(titulo)) > 0),
  texto text NOT NULL CHECK (length(btrim(texto)) > 0),
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, atalho)
);

-- Segurança: tudo por empresa. Equipe inteira vê e movimenta os atendimentos;
-- etiquetas, etapas e atalhos só o admin cria/edita; apagar atendimento só admin (o resto arquiva).
DO $$
DECLARE
  t text;
  mesma_empresa constant text := 'empresa_id = public.current_empresa_id() AND public.empresa_ativa(empresa_id)';
BEGIN
  FOREACH t IN ARRAY ARRAY['crm_etiquetas', 'client_etiquetas', 'crm_etapas', 'atendimentos', 'atendimento_mensagens', 'crm_modelos_mensagem'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (%s)', t || '_select', t, mesma_empresa);
  END LOOP;

  FOREACH t IN ARRAY ARRAY['crm_etiquetas', 'crm_etapas', 'crm_modelos_mensagem'] LOOP
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (%s AND public.is_profile_admin(auth.uid())) WITH CHECK (%s AND public.is_profile_admin(auth.uid()))',
      t || '_admin_write', t, mesma_empresa, mesma_empresa);
  END LOOP;

  FOREACH t IN ARRAY ARRAY['client_etiquetas', 'atendimentos', 'atendimento_mensagens'] LOOP
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (%s)', t || '_insert', t, mesma_empresa);
  END LOOP;

  EXECUTE format('CREATE POLICY atendimentos_update ON public.atendimentos FOR UPDATE TO authenticated USING (%s) WITH CHECK (%s)', mesma_empresa, mesma_empresa);
  EXECUTE format('CREATE POLICY atendimentos_delete ON public.atendimentos FOR DELETE TO authenticated USING (%s AND public.is_profile_admin(auth.uid()))', mesma_empresa);
  EXECUTE format('CREATE POLICY client_etiquetas_delete ON public.client_etiquetas FOR DELETE TO authenticated USING (%s)', mesma_empresa);
  -- mensagens não são editadas; quem escreveu (ou o admin) pode apagar
  EXECUTE format('CREATE POLICY atendimento_mensagens_delete ON public.atendimento_mensagens FOR DELETE TO authenticated USING (%s AND (user_id = auth.uid() OR public.is_profile_admin(auth.uid())))', mesma_empresa);

  FOREACH t IN ARRAY ARRAY['crm_etiquetas', 'crm_etapas', 'atendimentos', 'crm_modelos_mensagem'] LOOP
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()',
      'update_' || t || '_updated_at', t);
  END LOOP;
END $$;

-- Quadro atualiza sozinho para toda a equipe
ALTER PUBLICATION supabase_realtime ADD TABLE public.atendimentos;
ALTER PUBLICATION supabase_realtime ADD TABLE public.atendimento_mensagens;

-- Anexos dos atendimentos: pasta privada, uma subpasta por empresa (<empresa_id>/<atendimento_id>/arquivo)
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('atendimento-anexos', 'atendimento-anexos', false, 20971520)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "atendimento_anexos_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'atendimento-anexos' AND (storage.foldername(name))[1] = public.current_empresa_id()::text);
CREATE POLICY "atendimento_anexos_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'atendimento-anexos' AND (storage.foldername(name))[1] = public.current_empresa_id()::text);
CREATE POLICY "atendimento_anexos_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'atendimento-anexos' AND (storage.foldername(name))[1] = public.current_empresa_id()::text
         AND public.is_profile_admin(auth.uid()));

-- Carga inicial para cada empresa existente (tudo editável depois na tela)
INSERT INTO public.crm_etapas (empresa_id, nome, cor, sort_order, is_final, retorno_auto_dias)
SELECT e.id, v.nome, v.cor, v.ord, v.fim, v.dias
FROM public.empresas e
CROSS JOIN (VALUES
  ('Novo',                 '#64748b', 10, false, NULL::int),
  ('Orçamento',            '#3b82f6', 20, false, NULL),
  ('Aguardando aprovação', '#f59e0b', 30, false, 2),
  ('Em produção',          '#8b5cf6', 40, false, NULL),
  ('Pronto',               '#10b981', 50, false, NULL),
  ('Entregue',             '#0f766e', 60, true,  NULL)
) AS v(nome, cor, ord, fim, dias);

INSERT INTO public.crm_etiquetas (empresa_id, nome, cor, prioridade, sort_order)
SELECT e.id, v.nome, v.cor, v.pri, v.ord
FROM public.empresas e
CROSS JOIN (VALUES
  ('Prioridade', '#ef4444', true,  10),
  ('Recorrente', '#8b5cf6', false, 20)
) AS v(nome, cor, pri, ord);

-- Quem já tem produto recorrente ativo começa com a etiqueta "Recorrente"
INSERT INTO public.client_etiquetas (empresa_id, client_id, etiqueta_id)
SELECT DISTINCT c.empresa_id, c.id, et.id
FROM public.client_recurring_products r
JOIN public.clients c ON c.id = r.client_id
JOIN public.crm_etiquetas et ON et.empresa_id = c.empresa_id AND et.nome = 'Recorrente'
WHERE r.ativo
ON CONFLICT (client_id, etiqueta_id) DO NOTHING;

INSERT INTO public.crm_modelos_mensagem (empresa_id, atalho, titulo, texto, sort_order)
SELECT e.id, v.atalho, v.titulo, v.texto, v.ord
FROM public.empresas e
CROSS JOIN (VALUES
  ('oi',        'Saudação',                 '{saudacao}, {nome}! Aqui é {atendente}, da {empresa}. Como posso ajudar?', 10),
  ('pronto',    'Pedido pronto',            '{nome}, seu pedido {pedido} está pronto e já pode ser retirado.', 20),
  ('orcamento', 'Orçamento enviado',        '{nome}, segue o orçamento {orcamento}. Qualquer dúvida é só chamar.', 30),
  ('retorno',   'Cobrar retorno',           '{saudacao}, {nome}! Conseguiu ver o orçamento {orcamento}? Posso seguir com a produção?', 40),
  ('arte',      'Aguardando arte',          '{nome}, para seguir com o pedido precisamos do arquivo da arte em PDF. Consegue nos enviar?', 50),
  ('producao',  'Entrou em produção',       '{nome}, seu pedido {pedido} entrou em produção. Avisamos assim que ficar pronto.', 60),
  ('obrigado',  'Agradecimento',            'Obrigado pela preferência, {nome}! Precisando, é só chamar.', 70)
) AS v(atalho, titulo, texto, ord);
