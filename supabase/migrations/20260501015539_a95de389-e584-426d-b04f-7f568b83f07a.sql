-- =====================================================
-- 1) Helper: identificar usuários do Financeiro
-- =====================================================
CREATE OR REPLACE FUNCTION public.is_financeiro_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = _user_id
      AND is_active = true
      AND (
        role = 'admin'
        OR display_name IN ('Juliano', 'Marcelle')
      )
  );
$$;

-- =====================================================
-- 2) Numeração automática de pedidos PED-AAAA-NNNN
-- =====================================================
CREATE TABLE IF NOT EXISTS public.sales_order_counters (
  year integer PRIMARY KEY,
  last_number integer NOT NULL DEFAULT 0
);
ALTER TABLE public.sales_order_counters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read sales_order_counters"
  ON public.sales_order_counters FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.next_order_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year integer := EXTRACT(YEAR FROM now())::int;
  v_next integer;
BEGIN
  INSERT INTO public.sales_order_counters (year, last_number)
  VALUES (v_year, 1)
  ON CONFLICT (year) DO UPDATE
    SET last_number = sales_order_counters.last_number + 1
  RETURNING last_number INTO v_next;

  RETURN 'PED-' || v_year || '-' || lpad(v_next::text, 4, '0');
END;
$$;

-- =====================================================
-- 3) Tabela: sales_orders
-- =====================================================
CREATE TABLE public.sales_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text NOT NULL UNIQUE,
  client_id uuid,
  client_name text NOT NULL,
  quote_id uuid REFERENCES public.quotes(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'aberto',
  total_value numeric NOT NULL DEFAULT 0,
  payment_terms text,
  payment_method text,
  delivery_date date,
  internal_notes text,
  production_notes text,
  created_by uuid,
  approved_by uuid,
  approved_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sales_orders_status ON public.sales_orders(status);
CREATE INDEX idx_sales_orders_client_id ON public.sales_orders(client_id);
CREATE INDEX idx_sales_orders_quote_id ON public.sales_orders(quote_id);
CREATE INDEX idx_sales_orders_created_at ON public.sales_orders(created_at DESC);

ALTER TABLE public.sales_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read sales_orders"
  ON public.sales_orders FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated insert sales_orders"
  ON public.sales_orders FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Authenticated update sales_orders"
  ON public.sales_orders FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Admin delete sales_orders"
  ON public.sales_orders FOR DELETE TO authenticated
  USING (is_profile_admin(auth.uid()));

CREATE TRIGGER trg_sales_orders_updated_at
  BEFORE UPDATE ON public.sales_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-gerar order_number
CREATE OR REPLACE FUNCTION public.set_order_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
    NEW.order_number := public.next_order_number();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sales_orders_set_number
  BEFORE INSERT ON public.sales_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_order_number();

-- =====================================================
-- 4) Tabela: sales_order_items
-- =====================================================
CREATE TABLE public.sales_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.sales_orders(id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  line_total numeric NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sales_order_items_order_id ON public.sales_order_items(order_id);

ALTER TABLE public.sales_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated all sales_order_items"
  ON public.sales_order_items FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- =====================================================
-- 5) Tabela: sales_order_status_history
-- =====================================================
CREATE TABLE public.sales_order_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.sales_orders(id) ON DELETE CASCADE,
  from_status text,
  to_status text NOT NULL,
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now(),
  note text
);

CREATE INDEX idx_sales_order_status_history_order_id
  ON public.sales_order_status_history(order_id, changed_at DESC);

ALTER TABLE public.sales_order_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read sales_order_status_history"
  ON public.sales_order_status_history FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated insert sales_order_status_history"
  ON public.sales_order_status_history FOR INSERT TO authenticated
  WITH CHECK (true);

-- =====================================================
-- 6) Trigger: validar e registrar mudanças de status
-- =====================================================
CREATE OR REPLACE FUNCTION public.handle_sales_order_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  -- valida status
  IF NEW.status NOT IN ('aberto','aprovado','em_producao','entregue','cancelado') THEN
    RAISE EXCEPTION 'Status inválido: %', NEW.status;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    -- bloqueia aprovação ou cancelamento por não-financeiro
    IF NEW.status IN ('aprovado','cancelado')
       AND NOT public.is_financeiro_user(v_uid) THEN
      RAISE EXCEPTION 'Apenas usuários do Financeiro podem aprovar ou cancelar pedidos.';
    END IF;

    -- bloqueia editar pedido cancelado/entregue (exceto admin)
    IF OLD.status IN ('cancelado','entregue')
       AND NEW.status <> OLD.status
       AND NOT public.is_profile_admin(v_uid) THEN
      RAISE EXCEPTION 'Pedidos % não podem ser reabertos.', OLD.status;
    END IF;

    -- carimba aprovação
    IF NEW.status = 'aprovado' AND OLD.status <> 'aprovado' THEN
      NEW.approved_at := now();
      NEW.approved_by := v_uid;
    END IF;

    IF NEW.status = 'cancelado' AND OLD.status <> 'cancelado' THEN
      NEW.cancelled_at := now();
    END IF;

    -- registra histórico
    INSERT INTO public.sales_order_status_history (order_id, from_status, to_status, changed_by)
    VALUES (NEW.id, OLD.status, NEW.status, v_uid);

    -- audit log
    INSERT INTO public.audit_logs (action, entity_type, entity_id, entity_name, details)
    VALUES (
      'sales_order_status_change',
      'sales_order',
      NEW.id::text,
      NEW.order_number,
      'Status: ' || OLD.status || ' → ' || NEW.status
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sales_orders_status_change
  BEFORE UPDATE ON public.sales_orders
  FOR EACH ROW EXECUTE FUNCTION public.handle_sales_order_status_change();

-- Histórico inicial no INSERT
CREATE OR REPLACE FUNCTION public.handle_sales_order_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.sales_order_status_history (order_id, from_status, to_status, changed_by)
  VALUES (NEW.id, NULL, NEW.status, auth.uid());
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sales_orders_after_insert
  AFTER INSERT ON public.sales_orders
  FOR EACH ROW EXECUTE FUNCTION public.handle_sales_order_insert();

-- =====================================================
-- 7) Tabela: accounts_receivable
-- =====================================================
CREATE TABLE public.accounts_receivable (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.sales_orders(id) ON DELETE SET NULL,
  client_id uuid,
  client_name text NOT NULL,
  description text NOT NULL,
  total_value numeric NOT NULL DEFAULT 0,
  category text NOT NULL DEFAULT 'venda',
  status text NOT NULL DEFAULT 'aberto',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_accounts_receivable_status ON public.accounts_receivable(status);
CREATE INDEX idx_accounts_receivable_order_id ON public.accounts_receivable(order_id);
CREATE INDEX idx_accounts_receivable_client_id ON public.accounts_receivable(client_id);

ALTER TABLE public.accounts_receivable ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Financeiro read accounts_receivable"
  ON public.accounts_receivable FOR SELECT TO authenticated
  USING (public.is_financeiro_user(auth.uid()));

CREATE POLICY "Financeiro insert accounts_receivable"
  ON public.accounts_receivable FOR INSERT TO authenticated
  WITH CHECK (public.is_financeiro_user(auth.uid()));

CREATE POLICY "Financeiro update accounts_receivable"
  ON public.accounts_receivable FOR UPDATE TO authenticated
  USING (public.is_financeiro_user(auth.uid()));

CREATE POLICY "Financeiro delete accounts_receivable"
  ON public.accounts_receivable FOR DELETE TO authenticated
  USING (public.is_financeiro_user(auth.uid()));

CREATE TRIGGER trg_accounts_receivable_updated_at
  BEFORE UPDATE ON public.accounts_receivable
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- 8) Tabela: accounts_receivable_installments
-- =====================================================
CREATE TABLE public.accounts_receivable_installments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts_receivable(id) ON DELETE CASCADE,
  installment_number integer NOT NULL DEFAULT 1,
  due_date date NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  paid_at timestamptz,
  paid_amount numeric,
  payment_method text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ar_installments_account ON public.accounts_receivable_installments(account_id);
CREATE INDEX idx_ar_installments_due_date ON public.accounts_receivable_installments(due_date);
CREATE INDEX idx_ar_installments_paid ON public.accounts_receivable_installments(paid_at);

ALTER TABLE public.accounts_receivable_installments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Financeiro read ar_installments"
  ON public.accounts_receivable_installments FOR SELECT TO authenticated
  USING (public.is_financeiro_user(auth.uid()));

CREATE POLICY "Financeiro insert ar_installments"
  ON public.accounts_receivable_installments FOR INSERT TO authenticated
  WITH CHECK (public.is_financeiro_user(auth.uid()));

CREATE POLICY "Financeiro update ar_installments"
  ON public.accounts_receivable_installments FOR UPDATE TO authenticated
  USING (public.is_financeiro_user(auth.uid()));

CREATE POLICY "Financeiro delete ar_installments"
  ON public.accounts_receivable_installments FOR DELETE TO authenticated
  USING (public.is_financeiro_user(auth.uid()));

CREATE TRIGGER trg_ar_installments_updated_at
  BEFORE UPDATE ON public.accounts_receivable_installments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- 9) Trigger: recalcular status da conta-pai
-- =====================================================
CREATE OR REPLACE FUNCTION public.recalc_account_receivable_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account_id uuid := COALESCE(NEW.account_id, OLD.account_id);
  v_total int;
  v_paid int;
  v_status text;
BEGIN
  SELECT COUNT(*) INTO v_total
    FROM public.accounts_receivable_installments
   WHERE account_id = v_account_id;

  SELECT COUNT(*) INTO v_paid
    FROM public.accounts_receivable_installments
   WHERE account_id = v_account_id AND paid_at IS NOT NULL;

  IF v_total = 0 THEN
    v_status := 'aberto';
  ELSIF v_paid = 0 THEN
    v_status := 'aberto';
  ELSIF v_paid < v_total THEN
    v_status := 'parcial';
  ELSE
    v_status := 'pago';
  END IF;

  UPDATE public.accounts_receivable
     SET status = v_status, updated_at = now()
   WHERE id = v_account_id
     AND status <> 'cancelado'
     AND status IS DISTINCT FROM v_status;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_ar_installments_recalc
  AFTER INSERT OR UPDATE OR DELETE ON public.accounts_receivable_installments
  FOR EACH ROW EXECUTE FUNCTION public.recalc_account_receivable_status();

-- =====================================================
-- 10) RPC: criar conta a receber a partir de pedido (com parcelas)
-- =====================================================
CREATE OR REPLACE FUNCTION public.create_receivable_from_order(
  p_order_id uuid,
  p_installments jsonb  -- [{"due_date":"2026-06-01","amount":100,"payment_method":"pix"}, ...]
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.sales_orders%ROWTYPE;
  v_account_id uuid;
  v_inst jsonb;
  v_idx int := 0;
  v_total numeric := 0;
BEGIN
  IF NOT public.is_financeiro_user(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas usuários do Financeiro podem gerar contas a receber.';
  END IF;

  SELECT * INTO v_order FROM public.sales_orders WHERE id = p_order_id;
  IF v_order.id IS NULL THEN
    RAISE EXCEPTION 'Pedido não encontrado.';
  END IF;

  -- Bloqueia duplicação
  IF EXISTS (SELECT 1 FROM public.accounts_receivable WHERE order_id = p_order_id AND status <> 'cancelado') THEN
    RAISE EXCEPTION 'Já existe conta a receber ativa para o pedido %.', v_order.order_number;
  END IF;

  -- Total
  SELECT COALESCE(SUM((x->>'amount')::numeric), 0)
    INTO v_total
    FROM jsonb_array_elements(p_installments) x;

  INSERT INTO public.accounts_receivable
    (order_id, client_id, client_name, description, total_value, category, status, created_by)
  VALUES (
    p_order_id,
    v_order.client_id,
    v_order.client_name,
    'Pedido ' || v_order.order_number,
    v_total,
    'venda',
    'aberto',
    auth.uid()
  )
  RETURNING id INTO v_account_id;

  FOR v_inst IN SELECT * FROM jsonb_array_elements(p_installments) LOOP
    v_idx := v_idx + 1;
    INSERT INTO public.accounts_receivable_installments
      (account_id, installment_number, due_date, amount, payment_method)
    VALUES (
      v_account_id,
      v_idx,
      (v_inst->>'due_date')::date,
      (v_inst->>'amount')::numeric,
      v_inst->>'payment_method'
    );
  END LOOP;

  RETURN v_account_id;
END;
$$;

-- =====================================================
-- 11) Realtime
-- =====================================================
ALTER TABLE public.sales_orders REPLICA IDENTITY FULL;
ALTER TABLE public.sales_order_items REPLICA IDENTITY FULL;
ALTER TABLE public.accounts_receivable REPLICA IDENTITY FULL;
ALTER TABLE public.accounts_receivable_installments REPLICA IDENTITY FULL;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='sales_orders') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.sales_orders';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='sales_order_items') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.sales_order_items';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='accounts_receivable') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.accounts_receivable';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='accounts_receivable_installments') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.accounts_receivable_installments';
  END IF;
END $$;