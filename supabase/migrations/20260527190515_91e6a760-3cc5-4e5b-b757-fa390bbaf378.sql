-- =============================================================================
-- Migration B (P0) — Tenant guards nas RPCs SECURITY DEFINER
-- =============================================================================
-- Bug corrigido: funções SECURITY DEFINER bypassam RLS, então passar um UUID
-- de outro tenant funcionava silenciosamente. Aqui validamos empresa_id ANTES
-- de qualquer escrita. Helpers da Migration A (is_tenant_admin /
-- is_tenant_financeiro) opcionalmente usados onde o controle de role também
-- importava cruzar com a empresa.
-- =============================================================================

-- ---------- 1) approve_quote_items ----------
CREATE OR REPLACE FUNCTION public.approve_quote_items(p_quote_id uuid, p_item_ids uuid[])
 RETURNS TABLE(approved_count integer, total_value numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_quote_locked boolean;
  v_quote_empresa uuid;
  v_count integer;
  v_total numeric;
  v_quote record;
  v_items_text text;
  v_extra integer;
  v_root_total integer;
  v_root_approved integer;
  v_is_full boolean;
  v_title text;
  v_msg text;
  v_total_br text;
  v_type text;
  v_user record;
BEGIN
  -- TENANT GUARD: orçamento precisa ser da empresa do chamador
  SELECT is_locked, empresa_id INTO v_quote_locked, v_quote_empresa
    FROM public.quotes WHERE id = p_quote_id;
  IF v_quote_locked IS NULL THEN
    RAISE EXCEPTION 'Orçamento não encontrado.';
  END IF;
  IF v_quote_empresa IS DISTINCT FROM public.current_empresa_id() THEN
    RAISE EXCEPTION 'Acesso negado: orçamento pertence a outra empresa.';
  END IF;
  IF v_quote_locked THEN
    RAISE EXCEPTION 'Este orçamento foi substituído por uma nova versão.';
  END IF;
  IF p_item_ids IS NULL OR array_length(p_item_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'Nenhum item selecionado.';
  END IF;

  UPDATE public.quote_materials
     SET status = 'aprovado'
   WHERE quote_id = p_quote_id
     AND id = ANY(p_item_ids)
     AND status = 'pendente';
  GET DIAGNOSTICS v_count = ROW_COUNT;

  UPDATE public.quote_materials
     SET status = 'aprovado'
   WHERE quote_id = p_quote_id
     AND parent_item_id = ANY(p_item_ids)
     AND status = 'pendente';

  SELECT COALESCE(SUM(approved_value), 0) INTO v_total
    FROM public.quote_materials
   WHERE quote_id = p_quote_id
     AND status = 'aprovado'
     AND parent_item_id IS NULL;

  UPDATE public.quotes q
     SET status = CASE
       WHEN NOT EXISTS (SELECT 1 FROM public.quote_materials WHERE quote_id = q.id AND status = 'pendente')
        AND EXISTS    (SELECT 1 FROM public.quote_materials WHERE quote_id = q.id AND status = 'aprovado') THEN 'approved'
       WHEN EXISTS    (SELECT 1 FROM public.quote_materials WHERE quote_id = q.id AND status = 'aprovado') THEN 'partial'
       ELSE q.status END,
     updated_at = now()
   WHERE id = p_quote_id;

  IF v_count > 0 THEN
    SELECT quote_number, client, status INTO v_quote FROM public.quotes WHERE id = p_quote_id;

    WITH picked AS (
      SELECT COALESCE(NULLIF(generated_title, ''), NULLIF(custom_name, ''), description) AS nome
        FROM public.quote_materials
       WHERE quote_id = p_quote_id AND id = ANY(p_item_ids)
         AND parent_item_id IS NULL AND status = 'aprovado'
       ORDER BY sort_order
    ), top3 AS (SELECT nome, row_number() OVER () AS rn FROM picked)
    SELECT string_agg(CASE WHEN rn <= 3 THEN nome END, ', ' ORDER BY rn) FILTER (WHERE rn <= 3),
           GREATEST(0, (SELECT count(*) FROM picked) - 3)
      INTO v_items_text, v_extra FROM top3;
    IF v_extra > 0 THEN v_items_text := v_items_text || ' e mais ' || v_extra; END IF;

    SELECT count(*) FILTER (WHERE parent_item_id IS NULL),
           count(*) FILTER (WHERE parent_item_id IS NULL AND status = 'aprovado')
      INTO v_root_total, v_root_approved
      FROM public.quote_materials WHERE quote_id = p_quote_id;

    v_is_full := v_quote.status = 'approved';
    IF v_is_full THEN
      v_title := 'Orçamento Nº ' || v_quote.quote_number || ' aprovado integralmente';
      v_type := 'success';
    ELSE
      v_title := 'Novo aceite — Orçamento Nº ' || v_quote.quote_number;
      v_type := 'info';
    END IF;
    v_total_br := translate(to_char(v_total, 'FM999G999G990D00'), '.,', ',.');
    v_msg := v_quote.client || ' aprovou ' || v_count || ' '
      || CASE WHEN v_count = 1 THEN 'item' ELSE 'itens' END
      || COALESCE(': ' || v_items_text, '')
      || '. Total acumulado aprovado: R$ ' || v_total_br
      || ' (' || v_root_approved || ' de ' || v_root_total || ' itens).';

    -- Só notifica usuários da MESMA empresa do orçamento
    FOR v_user IN
      SELECT user_id FROM public.profiles WHERE empresa_id = v_quote_empresa AND is_active = true
    LOOP
      INSERT INTO public.notifications (user_id, title, message, type, source_type, source_id)
      VALUES (v_user.user_id, v_title, v_msg, v_type, 'quote_approval', p_quote_id);
    END LOOP;
  END IF;

  RETURN QUERY SELECT v_count, v_total;
END;
$function$;

-- ---------- 2) delete_quotes_bulk ----------
CREATE OR REPLACE FUNCTION public.delete_quotes_bulk(p_ids uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_id uuid;
  v_quote record;
  v_has_child boolean;
  v_deleted int := 0;
  v_skipped jsonb := '[]'::jsonb;
  v_current_empresa uuid := public.current_empresa_id();
BEGIN
  IF NOT public.is_profile_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas administradores podem excluir orçamentos.';
  END IF;
  IF v_current_empresa IS NULL THEN
    RAISE EXCEPTION 'Empresa do chamador não pôde ser determinada.';
  END IF;
  IF p_ids IS NULL OR array_length(p_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'Nenhum orçamento selecionado.';
  END IF;

  FOREACH v_id IN ARRAY p_ids LOOP
    SELECT id, quote_number, is_locked, empresa_id INTO v_quote
      FROM public.quotes WHERE id = v_id;
    IF v_quote.id IS NULL THEN
      v_skipped := v_skipped || jsonb_build_object('id', v_id, 'reason', 'não encontrado');
      CONTINUE;
    END IF;

    -- TENANT GUARD por item
    IF v_quote.empresa_id IS DISTINCT FROM v_current_empresa THEN
      v_skipped := v_skipped || jsonb_build_object('id', v_id, 'number', v_quote.quote_number,
        'reason', 'acesso negado: outra empresa');
      CONTINUE;
    END IF;

    IF v_quote.is_locked THEN
      v_skipped := v_skipped || jsonb_build_object('id', v_id, 'number', v_quote.quote_number,
        'reason', 'orçamento travado (possui versão mais recente)');
      CONTINUE;
    END IF;
    SELECT EXISTS(SELECT 1 FROM public.quotes WHERE parent_quote_id = v_id) INTO v_has_child;
    IF v_has_child THEN
      v_skipped := v_skipped || jsonb_build_object('id', v_id, 'number', v_quote.quote_number,
        'reason', 'possui versão filha vinculada');
      CONTINUE;
    END IF;

    DELETE FROM public.quote_engagement_events WHERE quote_id = v_id;
    DELETE FROM public.quote_materials         WHERE quote_id = v_id;
    DELETE FROM public.quote_labor_steps       WHERE quote_id = v_id;
    DELETE FROM public.quote_third_party       WHERE quote_id = v_id;
    DELETE FROM public.quote_reminders         WHERE quote_id = v_id;
    DELETE FROM public.quotes                  WHERE id = v_id;

    INSERT INTO public.audit_logs (action, entity_type, entity_id, entity_name, details)
    VALUES ('delete_quote', 'quote', v_id::text, v_quote.quote_number,
            'Orçamento excluído por ' || COALESCE(auth.uid()::text, 'desconhecido'));
    v_deleted := v_deleted + 1;
  END LOOP;

  RETURN jsonb_build_object('deleted_count', v_deleted, 'skipped', v_skipped);
END;
$function$;

-- ---------- 3) create_quote_version ----------
CREATE OR REPLACE FUNCTION public.create_quote_version(p_quote_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_old_quote public.quotes%ROWTYPE;
  v_new_id uuid;
  v_new_version integer;
BEGIN
  IF NOT public.is_profile_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas administradores podem criar nova versão de orçamento.';
  END IF;

  SELECT * INTO v_old_quote FROM public.quotes WHERE id = p_quote_id;
  IF v_old_quote.id IS NULL THEN
    RAISE EXCEPTION 'Orçamento não encontrado.';
  END IF;

  -- TENANT GUARD
  IF v_old_quote.empresa_id IS DISTINCT FROM public.current_empresa_id() THEN
    RAISE EXCEPTION 'Acesso negado: orçamento pertence a outra empresa.';
  END IF;

  v_new_version := v_old_quote.version + 1;

  INSERT INTO public.quotes (
    quote_number, client, product, value, status, date, validity,
    discount_value, discount_type, payment_method, options,
    version, parent_quote_id, profit_margin,
    client_id, client_phone, notes, attention_to,
    hidden_extras_value, freight_value, freight_type_id,
    tags, main_quantity
  ) VALUES (
    v_old_quote.quote_number, v_old_quote.client, v_old_quote.product, v_old_quote.value,
    'pending', CURRENT_DATE, v_old_quote.validity,
    v_old_quote.discount_value, v_old_quote.discount_type, v_old_quote.payment_method, v_old_quote.options,
    v_new_version, p_quote_id, v_old_quote.profit_margin,
    v_old_quote.client_id, v_old_quote.client_phone, v_old_quote.notes, v_old_quote.attention_to,
    v_old_quote.hidden_extras_value, v_old_quote.freight_value, v_old_quote.freight_type_id,
    v_old_quote.tags, v_old_quote.main_quantity
  )
  RETURNING id INTO v_new_id;

  CREATE TEMP TABLE _qm_map(old_id uuid PRIMARY KEY, new_id uuid NOT NULL) ON COMMIT DROP;

  WITH src AS (
    SELECT id AS old_id, gen_random_uuid() AS new_id, *
      FROM public.quote_materials
     WHERE quote_id = p_quote_id AND parent_item_id IS NULL
  ), ins AS (
    INSERT INTO public.quote_materials (
      id, quote_id, description, quantity, unit_price, sort_order,
      status, approved_at, approved_value, parent_item_id,
      product_kind, custom_name, reference, generated_title,
      paper_type, grammage, size, side, catalog_source, catalog_item_id
    )
    SELECT s.new_id, v_new_id, s.description, s.quantity, s.unit_price, s.sort_order,
           s.status, s.approved_at, s.approved_value, NULL,
           s.product_kind, s.custom_name, s.reference, s.generated_title,
           s.paper_type, s.grammage, s.size, s.side, s.catalog_source, s.catalog_item_id
      FROM src s RETURNING id
  )
  INSERT INTO _qm_map(old_id, new_id) SELECT old_id, new_id FROM src;

  INSERT INTO public.quote_materials (
    quote_id, description, quantity, unit_price, sort_order,
    status, approved_at, approved_value, parent_item_id,
    product_kind, custom_name, reference, generated_title,
    paper_type, grammage, size, side, catalog_source, catalog_item_id
  )
  SELECT v_new_id, m.description, m.quantity, m.unit_price, m.sort_order,
         m.status, m.approved_at, m.approved_value, mp.new_id,
         m.product_kind, m.custom_name, m.reference, m.generated_title,
         m.paper_type, m.grammage, m.size, m.side, m.catalog_source, m.catalog_item_id
    FROM public.quote_materials m
    JOIN _qm_map mp ON mp.old_id = m.parent_item_id
   WHERE m.quote_id = p_quote_id AND m.parent_item_id IS NOT NULL;

  INSERT INTO public.quote_labor_steps (
    quote_id, description, time_minutes, sort_order, parent_item_id, step_type
  )
  SELECT v_new_id, l.description, l.time_minutes, l.sort_order, mp.new_id, l.step_type
    FROM public.quote_labor_steps l
    LEFT JOIN _qm_map mp ON mp.old_id = l.parent_item_id
   WHERE l.quote_id = p_quote_id;

  UPDATE public.quotes SET is_locked = true, updated_at = now() WHERE id = p_quote_id;
  RETURN v_new_id;
END;
$function$;

-- ---------- 4) create_receivable_from_order ----------
CREATE OR REPLACE FUNCTION public.create_receivable_from_order(p_order_id uuid, p_installments jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_order public.sales_orders%ROWTYPE;
  v_account_id uuid;
  v_total numeric := 0;
  v_inst jsonb;
  v_idx integer := 0;
BEGIN
  SELECT * INTO v_order FROM public.sales_orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado.';
  END IF;

  -- TENANT GUARD + papel financeiro DA mesma empresa
  IF v_order.empresa_id IS DISTINCT FROM public.current_empresa_id() THEN
    RAISE EXCEPTION 'Acesso negado: pedido pertence a outra empresa.';
  END IF;
  IF NOT public.is_tenant_financeiro(v_order.empresa_id) THEN
    RAISE EXCEPTION 'Apenas usuários do Financeiro podem gerar contas a receber.';
  END IF;

  SELECT id INTO v_account_id
    FROM public.accounts_receivable
   WHERE order_id = p_order_id AND status <> 'cancelado' LIMIT 1;

  IF v_account_id IS NOT NULL THEN
    DELETE FROM public.accounts_receivable_installments WHERE account_id = v_account_id;
  ELSE
    SELECT COALESCE(SUM((value->>'amount')::numeric), 0) INTO v_total
      FROM jsonb_array_elements(p_installments) AS value;

    INSERT INTO public.accounts_receivable (
      order_id, client_id, client_name, description,
      total_value, status, category, created_by
    ) VALUES (
      v_order.id, v_order.client_id, v_order.client_name,
      'Pedido ' || v_order.order_number,
      COALESCE(NULLIF(v_total, 0), v_order.total_value),
      'aberto', 'venda', auth.uid()
    )
    RETURNING id INTO v_account_id;
  END IF;

  FOR v_inst IN SELECT * FROM jsonb_array_elements(p_installments) LOOP
    v_idx := v_idx + 1;
    INSERT INTO public.accounts_receivable_installments (
      account_id, installment_number, due_date, amount, payment_method
    ) VALUES (
      v_account_id, v_idx,
      (v_inst->>'due_date')::date,
      (v_inst->>'amount')::numeric,
      NULLIF(v_inst->>'payment_method', '')
    );
  END LOOP;

  RETURN v_account_id;
END;
$function$;

-- ---------- 5) mark_recurring_printed ----------
CREATE OR REPLACE FUNCTION public.mark_recurring_printed(
  p_recurring_id uuid, p_equipment_id uuid,
  p_carga_cor text, p_observacoes text,
  p_sales_order_id uuid DEFAULT NULL::uuid,
  p_quote_id uuid DEFAULT NULL::uuid
)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_id uuid;
  v_empresa uuid := public.current_empresa_id();
  v_check uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;
  IF v_empresa IS NULL THEN
    RAISE EXCEPTION 'Empresa do chamador não pôde ser determinada.';
  END IF;

  -- TENANT GUARD: recurring, equipment, sales_order e quote devem ser da mesma empresa
  SELECT empresa_id INTO v_check FROM public.client_recurring_products WHERE id = p_recurring_id;
  IF v_check IS NULL OR v_check <> v_empresa THEN
    RAISE EXCEPTION 'Acesso negado: produto recorrente inválido ou de outra empresa.';
  END IF;

  SELECT empresa_id INTO v_check FROM public.equipments WHERE id = p_equipment_id;
  IF v_check IS NULL OR v_check <> v_empresa THEN
    RAISE EXCEPTION 'Acesso negado: equipamento inválido ou de outra empresa.';
  END IF;

  IF p_sales_order_id IS NOT NULL THEN
    SELECT empresa_id INTO v_check FROM public.sales_orders WHERE id = p_sales_order_id;
    IF v_check IS NULL OR v_check <> v_empresa THEN
      RAISE EXCEPTION 'Acesso negado: pedido informado é de outra empresa.';
    END IF;
  END IF;

  IF p_quote_id IS NOT NULL THEN
    SELECT empresa_id INTO v_check FROM public.quotes WHERE id = p_quote_id;
    IF v_check IS NULL OR v_check <> v_empresa THEN
      RAISE EXCEPTION 'Acesso negado: orçamento informado é de outra empresa.';
    END IF;
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
$function$;

-- ---------- 6) register_quote_view ----------
CREATE OR REPLACE FUNCTION public.register_quote_view(quote_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_empresa uuid;
BEGIN
  -- TENANT GUARD: só conta visualização interna se for da mesma empresa
  SELECT empresa_id INTO v_empresa FROM public.quotes WHERE id = quote_id;
  IF v_empresa IS NULL OR v_empresa <> public.current_empresa_id() THEN
    RAISE EXCEPTION 'Acesso negado: orçamento inexistente ou de outra empresa.';
  END IF;

  UPDATE public.quotes
     SET view_count = COALESCE(view_count, 0) + 1,
         last_viewed_at = now()
   WHERE id = quote_id;
END;
$function$;