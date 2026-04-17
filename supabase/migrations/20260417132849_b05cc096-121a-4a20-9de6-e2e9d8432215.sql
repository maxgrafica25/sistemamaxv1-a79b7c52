-- 1. Adicionar campos à sites_monitorados
ALTER TABLE public.sites_monitorados
  ADD COLUMN IF NOT EXISTS metodo_coleta text NOT NULL DEFAULT 'url_simples',
  ADD COLUMN IF NOT EXISTS config_coleta jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS intervalo_check_horas integer NOT NULL DEFAULT 24;

-- 2. Tabela de tiers de preço
CREATE TABLE IF NOT EXISTS public.site_precos_tiers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  site_id uuid NOT NULL REFERENCES public.sites_monitorados(id) ON DELETE CASCADE,
  quantidade integer NOT NULL DEFAULT 1,
  preco_total numeric NOT NULL DEFAULT 0,
  preco_unitario numeric NOT NULL DEFAULT 0,
  preco_anterior numeric,
  ativo boolean NOT NULL DEFAULT true,
  atualizado_em timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (site_id, quantidade)
);

CREATE INDEX IF NOT EXISTS idx_site_precos_tiers_site_id ON public.site_precos_tiers(site_id);

ALTER TABLE public.site_precos_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth all site_precos_tiers"
  ON public.site_precos_tiers FOR ALL
  TO authenticated
  USING (true) WITH CHECK (true);

-- 3. Histórico por tier
CREATE TABLE IF NOT EXISTS public.historico_precos_tiers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tier_id uuid NOT NULL REFERENCES public.site_precos_tiers(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES public.sites_monitorados(id) ON DELETE CASCADE,
  quantidade integer NOT NULL,
  valor_total numeric NOT NULL,
  valor_unitario numeric NOT NULL,
  criado_em timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hist_tiers_tier_id ON public.historico_precos_tiers(tier_id);
CREATE INDEX IF NOT EXISTS idx_hist_tiers_site_id ON public.historico_precos_tiers(site_id);

ALTER TABLE public.historico_precos_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth all historico_precos_tiers"
  ON public.historico_precos_tiers FOR ALL
  TO authenticated
  USING (true) WITH CHECK (true);

-- 4. Trigger de mudança de preço por tier
CREATE OR REPLACE FUNCTION public.handle_tier_price_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user record;
  v_site record;
  v_diff numeric;
  v_pct numeric;
  v_priority text;
BEGIN
  IF NEW.preco_total IS NOT NULL AND NEW.preco_total IS DISTINCT FROM OLD.preco_total THEN
    -- histórico
    INSERT INTO public.historico_precos_tiers (tier_id, site_id, quantidade, valor_total, valor_unitario)
    VALUES (NEW.id, NEW.site_id, NEW.quantidade, NEW.preco_total, NEW.preco_unitario);

    -- alerta apenas em queda
    IF OLD.preco_total IS NOT NULL AND NEW.preco_total < OLD.preco_total THEN
      SELECT * INTO v_site FROM public.sites_monitorados WHERE id = NEW.site_id;
      v_diff := OLD.preco_total - NEW.preco_total;
      v_pct := CASE WHEN OLD.preco_total > 0 THEN (v_diff / OLD.preco_total) * 100 ELSE 0 END;
      v_priority := CASE WHEN v_pct >= 10 THEN 'alta' ELSE 'baixa' END;

      INSERT INTO public.alertas_precos (site_id, mensagem, prioridade, preco_novo, preco_antigo)
      VALUES (
        NEW.site_id,
        'Preço caiu ' || round(v_pct, 1) || '% em ' || v_site.nome_produto || ' (' || NEW.quantidade || ' un) - ' || COALESCE(v_site.fornecedor_nome, 'fornecedor'),
        v_priority,
        NEW.preco_total,
        OLD.preco_total
      );

      FOR v_user IN SELECT user_id FROM public.profiles LOOP
        INSERT INTO public.notifications (user_id, title, message, type, source_type, source_id)
        VALUES (
          v_user.user_id,
          'Queda de preço: ' || v_site.nome_produto || ' (' || NEW.quantidade || ' un)',
          'De R$ ' || replace(round(OLD.preco_total, 2)::text, '.', ',') || ' para R$ ' || replace(round(NEW.preco_total, 2)::text, '.', ',') || ' em ' || COALESCE(v_site.fornecedor_nome, 'fornecedor monitorado'),
          CASE WHEN v_priority = 'alta' THEN 'warning' ELSE 'info' END,
          'price_monitor_tier',
          NEW.id
        );
      END LOOP;
    END IF;

    NEW.preco_anterior := OLD.preco_total;
    NEW.atualizado_em := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tier_price_change ON public.site_precos_tiers;
CREATE TRIGGER trg_tier_price_change
  BEFORE UPDATE ON public.site_precos_tiers
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_tier_price_change();