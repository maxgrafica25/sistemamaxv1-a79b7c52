-- ============ TABELAS ============
CREATE TABLE public.sites_monitorados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_produto text NOT NULL,
  categoria text NOT NULL DEFAULT 'geral',
  url_completa text NOT NULL,
  seletor_css text NOT NULL,
  preco_atual numeric,
  preco_anterior numeric,
  fornecedor_nome text,
  ativo boolean NOT NULL DEFAULT true,
  timestamp_check timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.historico_precos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites_monitorados(id) ON DELETE CASCADE,
  valor numeric NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.alertas_precos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites_monitorados(id) ON DELETE CASCADE,
  mensagem text NOT NULL,
  prioridade text NOT NULL DEFAULT 'baixa',
  preco_novo numeric,
  preco_antigo numeric,
  lida boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_historico_precos_site ON public.historico_precos(site_id, criado_em DESC);
CREATE INDEX idx_alertas_lida ON public.alertas_precos(lida, created_at DESC);
CREATE INDEX idx_sites_categoria ON public.sites_monitorados(categoria);

-- ============ RLS ============
ALTER TABLE public.sites_monitorados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historico_precos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alertas_precos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth all sites_monitorados" ON public.sites_monitorados FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth all historico_precos" ON public.historico_precos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth all alertas_precos" ON public.alertas_precos FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============ TRIGGER updated_at ============
CREATE TRIGGER trg_sites_monitorados_updated
BEFORE UPDATE ON public.sites_monitorados
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ TRIGGER de queda de preço ============
CREATE OR REPLACE FUNCTION public.handle_price_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user record;
  v_diff numeric;
  v_pct numeric;
  v_priority text;
BEGIN
  -- Só age se o preço mudou de fato
  IF NEW.preco_atual IS NOT NULL AND NEW.preco_atual IS DISTINCT FROM OLD.preco_atual THEN
    -- Histórico
    INSERT INTO public.historico_precos (site_id, valor) VALUES (NEW.id, NEW.preco_atual);

    -- Alerta apenas em queda
    IF OLD.preco_atual IS NOT NULL AND NEW.preco_atual < OLD.preco_atual THEN
      v_diff := OLD.preco_atual - NEW.preco_atual;
      v_pct := CASE WHEN OLD.preco_atual > 0 THEN (v_diff / OLD.preco_atual) * 100 ELSE 0 END;
      v_priority := CASE WHEN v_pct >= 10 THEN 'alta' ELSE 'baixa' END;

      INSERT INTO public.alertas_precos (site_id, mensagem, prioridade, preco_novo, preco_antigo)
      VALUES (
        NEW.id,
        'Preço caiu ' || round(v_pct, 1) || '% em ' || NEW.nome_produto || ' (' || COALESCE(NEW.fornecedor_nome, 'fornecedor') || ')',
        v_priority,
        NEW.preco_atual,
        OLD.preco_atual
      );

      -- Notificação no sino para cada usuário
      FOR v_user IN SELECT user_id FROM public.profiles LOOP
        INSERT INTO public.notifications (user_id, title, message, type, source_type, source_id)
        VALUES (
          v_user.user_id,
          'Queda de preço: ' || NEW.nome_produto,
          'De R$ ' || replace(round(OLD.preco_atual, 2)::text, '.', ',') || ' para R$ ' || replace(round(NEW.preco_atual, 2)::text, '.', ',') || ' em ' || COALESCE(NEW.fornecedor_nome, 'fornecedor monitorado'),
          CASE WHEN v_priority = 'alta' THEN 'warning' ELSE 'info' END,
          'price_monitor',
          NEW.id
        );
      END LOOP;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_price_change
AFTER UPDATE ON public.sites_monitorados
FOR EACH ROW EXECUTE FUNCTION public.handle_price_change();

-- ============ Realtime ============
ALTER TABLE public.sites_monitorados REPLICA IDENTITY FULL;
ALTER TABLE public.historico_precos REPLICA IDENTITY FULL;
ALTER TABLE public.alertas_precos REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.sites_monitorados;
ALTER PUBLICATION supabase_realtime ADD TABLE public.historico_precos;
ALTER PUBLICATION supabase_realtime ADD TABLE public.alertas_precos;