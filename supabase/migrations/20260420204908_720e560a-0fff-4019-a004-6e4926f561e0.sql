-- 1) Add structured columns to alertas_precos
ALTER TABLE public.alertas_precos
  ADD COLUMN IF NOT EXISTS variacao_pct numeric,
  ADD COLUMN IF NOT EXISTS quantidade integer,
  ADD COLUMN IF NOT EXISTS fornecedor_nome text,
  ADD COLUMN IF NOT EXISTS produto_nome text;

-- 2) Update handle_price_change to populate the new columns
CREATE OR REPLACE FUNCTION public.handle_price_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user record;
  v_diff numeric;
  v_pct numeric;
  v_priority text;
BEGIN
  IF NEW.preco_atual IS NOT NULL AND NEW.preco_atual IS DISTINCT FROM OLD.preco_atual THEN
    INSERT INTO public.historico_precos (site_id, valor) VALUES (NEW.id, NEW.preco_atual);

    IF OLD.preco_atual IS NOT NULL AND NEW.preco_atual < OLD.preco_atual THEN
      v_diff := OLD.preco_atual - NEW.preco_atual;
      v_pct := CASE WHEN OLD.preco_atual > 0 THEN (v_diff / OLD.preco_atual) * 100 ELSE 0 END;
      v_priority := CASE WHEN v_pct >= 10 THEN 'alta' ELSE 'baixa' END;

      INSERT INTO public.alertas_precos (
        site_id, mensagem, prioridade, preco_novo, preco_antigo,
        variacao_pct, fornecedor_nome, produto_nome
      )
      VALUES (
        NEW.id,
        'Preço caiu ' || round(v_pct, 1) || '% em ' || NEW.nome_produto || ' (' || COALESCE(NEW.fornecedor_nome, 'fornecedor') || ')',
        v_priority,
        NEW.preco_atual,
        OLD.preco_atual,
        round(v_pct, 2),
        NEW.fornecedor_nome,
        NEW.nome_produto
      );

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
$function$;

-- 3) Update handle_tier_price_change to populate the new columns
CREATE OR REPLACE FUNCTION public.handle_tier_price_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user record;
  v_site record;
  v_diff numeric;
  v_pct numeric;
  v_priority text;
BEGIN
  IF NEW.preco_total IS NOT NULL AND NEW.preco_total IS DISTINCT FROM OLD.preco_total THEN
    INSERT INTO public.historico_precos_tiers (tier_id, site_id, quantidade, valor_total, valor_unitario)
    VALUES (NEW.id, NEW.site_id, NEW.quantidade, NEW.preco_total, NEW.preco_unitario);

    IF OLD.preco_total IS NOT NULL AND NEW.preco_total < OLD.preco_total THEN
      SELECT * INTO v_site FROM public.sites_monitorados WHERE id = NEW.site_id;
      v_diff := OLD.preco_total - NEW.preco_total;
      v_pct := CASE WHEN OLD.preco_total > 0 THEN (v_diff / OLD.preco_total) * 100 ELSE 0 END;
      v_priority := CASE WHEN v_pct >= 10 THEN 'alta' ELSE 'baixa' END;

      INSERT INTO public.alertas_precos (
        site_id, mensagem, prioridade, preco_novo, preco_antigo,
        variacao_pct, quantidade, fornecedor_nome, produto_nome
      )
      VALUES (
        NEW.site_id,
        'Preço caiu ' || round(v_pct, 1) || '% em ' || v_site.nome_produto || ' (' || NEW.quantidade || ' un) - ' || COALESCE(v_site.fornecedor_nome, 'fornecedor'),
        v_priority,
        NEW.preco_total,
        OLD.preco_total,
        round(v_pct, 2),
        NEW.quantidade,
        v_site.fornecedor_nome,
        v_site.nome_produto
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
$function$;