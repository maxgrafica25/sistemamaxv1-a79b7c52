
-- ============================================================
-- 1) Tabela: produtos recorrentes por cliente
-- ============================================================
CREATE TABLE public.client_recurring_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  nome text NOT NULL,
  quote_preset_id uuid REFERENCES public.quote_presets(id) ON DELETE SET NULL,
  drive_folder_url text,
  frequencia_dias integer NOT NULL DEFAULT 30 CHECK (frequencia_dias > 0),
  aviso_antecedencia_dias integer NOT NULL DEFAULT 3 CHECK (aviso_antecedencia_dias >= 0),
  ultima_impressao_em timestamptz,
  proxima_prevista_em date,
  observacoes text,
  ativo boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_crp_client ON public.client_recurring_products(client_id);
CREATE INDEX idx_crp_proxima ON public.client_recurring_products(proxima_prevista_em) WHERE ativo = true;

ALTER TABLE public.client_recurring_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read crp"
  ON public.client_recurring_products FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated insert crp"
  ON public.client_recurring_products FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated update crp"
  ON public.client_recurring_products FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin delete crp"
  ON public.client_recurring_products FOR DELETE TO authenticated USING (public.is_profile_admin(auth.uid()));

CREATE TRIGGER update_crp_updated_at
  BEFORE UPDATE ON public.client_recurring_products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Mantém proxima_prevista_em coerente com ultima_impressao_em + frequencia
CREATE OR REPLACE FUNCTION public.recalc_recurring_next_due()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.ultima_impressao_em IS NOT NULL THEN
    NEW.proxima_prevista_em := (NEW.ultima_impressao_em + (NEW.frequencia_dias || ' days')::interval)::date;
  ELSIF NEW.proxima_prevista_em IS NULL THEN
    NEW.proxima_prevista_em := (now() + (NEW.frequencia_dias || ' days')::interval)::date;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_crp_recalc_next
  BEFORE INSERT OR UPDATE OF ultima_impressao_em, frequencia_dias
  ON public.client_recurring_products
  FOR EACH ROW EXECUTE FUNCTION public.recalc_recurring_next_due();

-- ============================================================
-- 2) Histórico técnico de impressões
-- ============================================================
CREATE TABLE public.recurring_print_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recurring_id uuid NOT NULL REFERENCES public.client_recurring_products(id) ON DELETE CASCADE,
  sales_order_id uuid REFERENCES public.sales_orders(id) ON DELETE SET NULL,
  quote_id uuid REFERENCES public.quotes(id) ON DELETE SET NULL,
  equipment_id uuid REFERENCES public.equipments(id) ON DELETE SET NULL,
  carga_cor text,
  observacoes text,
  impresso_em timestamptz NOT NULL DEFAULT now(),
  operador_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_rph_recurring ON public.recurring_print_history(recurring_id, impresso_em DESC);

ALTER TABLE public.recurring_print_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read rph"
  ON public.recurring_print_history FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated insert rph"
  ON public.recurring_print_history FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Admin update rph"
  ON public.recurring_print_history FOR UPDATE TO authenticated USING (public.is_profile_admin(auth.uid()));

CREATE POLICY "Admin delete rph"
  ON public.recurring_print_history FOR DELETE TO authenticated USING (public.is_profile_admin(auth.uid()));

-- ============================================================
-- 3) Vínculo de pedidos/orçamentos a recorrentes
-- ============================================================
ALTER TABLE public.sales_orders ADD COLUMN IF NOT EXISTS recurring_id uuid REFERENCES public.client_recurring_products(id) ON DELETE SET NULL;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS recurring_id uuid REFERENCES public.client_recurring_products(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sales_orders_recurring ON public.sales_orders(recurring_id);
CREATE INDEX IF NOT EXISTS idx_quotes_recurring ON public.quotes(recurring_id);

-- Quando um orçamento/pedido vinculado é criado, marca notificações de "recurring_due" como lidas
CREATE OR REPLACE FUNCTION public.dismiss_recurring_reminder()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.recurring_id IS NOT NULL THEN
    UPDATE public.notifications
       SET read_at = now()
     WHERE source_type = 'recurring_due'
       AND source_id = NEW.recurring_id
       AND read_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sales_orders_dismiss_recurring
  AFTER INSERT ON public.sales_orders
  FOR EACH ROW WHEN (NEW.recurring_id IS NOT NULL)
  EXECUTE FUNCTION public.dismiss_recurring_reminder();

CREATE TRIGGER trg_quotes_dismiss_recurring
  AFTER INSERT ON public.quotes
  FOR EACH ROW WHEN (NEW.recurring_id IS NOT NULL)
  EXECUTE FUNCTION public.dismiss_recurring_reminder();

-- ============================================================
-- 4) Função para registrar impressão (uso pelo PostPrintDialog)
-- ============================================================
CREATE OR REPLACE FUNCTION public.mark_recurring_printed(
  p_recurring_id uuid,
  p_equipment_id uuid,
  p_carga_cor text,
  p_observacoes text,
  p_sales_order_id uuid DEFAULT NULL,
  p_quote_id uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;

  INSERT INTO public.recurring_print_history (
    recurring_id, sales_order_id, quote_id, equipment_id,
    carga_cor, observacoes, operador_id
  ) VALUES (
    p_recurring_id, p_sales_order_id, p_quote_id, p_equipment_id,
    NULLIF(btrim(p_carga_cor), ''), NULLIF(btrim(p_observacoes), ''), auth.uid()
  ) RETURNING id INTO v_id;

  UPDATE public.client_recurring_products
     SET ultima_impressao_em = now()
   WHERE id = p_recurring_id;

  RETURN v_id;
END;
$$;

-- ============================================================
-- 5) Enfileirar lembretes (chamada por cron diário)
-- ============================================================
CREATE OR REPLACE FUNCTION public.enqueue_recurring_reminders()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_count integer := 0;
  v_rec record;
  v_user record;
  v_dias integer;
BEGIN
  FOR v_rec IN
    SELECT r.id, r.nome, r.proxima_prevista_em, c.nome AS cliente_nome
      FROM public.client_recurring_products r
      JOIN public.clients c ON c.id = r.client_id
     WHERE r.ativo = true
       AND r.proxima_prevista_em IS NOT NULL
       AND r.proxima_prevista_em <= (CURRENT_DATE + (r.aviso_antecedencia_dias || ' days')::interval)
       AND NOT EXISTS (
         SELECT 1 FROM public.notifications n
          WHERE n.source_type = 'recurring_due'
            AND n.source_id = r.id
            AND n.read_at IS NULL
       )
  LOOP
    v_dias := (v_rec.proxima_prevista_em - CURRENT_DATE);
    FOR v_user IN SELECT user_id FROM public.profiles WHERE is_active = true LOOP
      INSERT INTO public.notifications (user_id, title, message, type, source_type, source_id)
      VALUES (
        v_user.user_id,
        'Recorrente: ' || v_rec.cliente_nome,
        v_rec.nome || ' — ' ||
        CASE
          WHEN v_dias < 0 THEN 'atrasado há ' || abs(v_dias) || ' dia(s)'
          WHEN v_dias = 0 THEN 'previsto para hoje'
          ELSE 'previsto em ' || v_dias || ' dia(s)'
        END,
        CASE WHEN v_dias < 0 THEN 'warning' ELSE 'info' END,
        'recurring_due',
        v_rec.id
      );
    END LOOP;
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;
