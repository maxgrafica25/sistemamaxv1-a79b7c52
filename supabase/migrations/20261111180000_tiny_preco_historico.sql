-- Histórico permanente dos preços enviados da Tabela de Preços para o Tiny (pedido do Juliano em 11/11/2026:
-- "não quero perder o histórico; o que vale hoje são os preços do Tiny"). Guarda o preço que estava no Tiny
-- antes de cada envio, para conferir ou voltar atrás. Só admin lê e grava; ninguém altera nem apaga pela tela.
CREATE TABLE public.tiny_preco_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL DEFAULT public.current_empresa_id() REFERENCES public.empresas(id) ON DELETE RESTRICT,
  sku text NOT NULL,
  item text,
  faixa text,
  preco_antes numeric,
  preco_novo numeric NOT NULL,
  ok boolean NOT NULL,
  erro text,
  user_id uuid DEFAULT auth.uid(),
  usuario text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tiny_preco_historico_empresa_data ON public.tiny_preco_historico (empresa_id, created_at DESC);
CREATE INDEX idx_tiny_preco_historico_sku ON public.tiny_preco_historico (empresa_id, sku);

ALTER TABLE public.tiny_preco_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY tiny_preco_historico_select ON public.tiny_preco_historico FOR SELECT TO authenticated
  USING (empresa_id = public.current_empresa_id() AND public.empresa_ativa(empresa_id) AND public.is_profile_admin(auth.uid()));

CREATE POLICY tiny_preco_historico_insert ON public.tiny_preco_historico FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.current_empresa_id() AND public.empresa_ativa(empresa_id) AND public.is_profile_admin(auth.uid())
              AND user_id = auth.uid());
