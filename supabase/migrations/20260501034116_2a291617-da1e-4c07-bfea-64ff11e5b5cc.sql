-- RPC para gerar Conta a Receber + parcelas a partir de um Pedido aprovado
CREATE OR REPLACE FUNCTION public.create_receivable_from_order(
  p_order_id uuid,
  p_installments jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.sales_orders%ROWTYPE;
  v_account_id uuid;
  v_total numeric := 0;
  v_inst jsonb;
  v_idx integer := 0;
BEGIN
  -- Permissão: somente Financeiro
  IF NOT public.is_financeiro_user(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas usuários do Financeiro podem gerar contas a receber.';
  END IF;

  SELECT * INTO v_order FROM public.sales_orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado.';
  END IF;

  -- Evita duplicidade: se já existe conta ativa para esse pedido, retorna ela
  SELECT id INTO v_account_id
  FROM public.accounts_receivable
  WHERE order_id = p_order_id AND status <> 'cancelado'
  LIMIT 1;

  IF v_account_id IS NOT NULL THEN
    -- Apaga parcelas antigas e recria
    DELETE FROM public.accounts_receivable_installments WHERE account_id = v_account_id;
  ELSE
    -- Soma do total das parcelas (para gravar como total_value)
    SELECT COALESCE(SUM((value->>'amount')::numeric), 0)
      INTO v_total
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

  -- Insere parcelas
  FOR v_inst IN SELECT * FROM jsonb_array_elements(p_installments)
  LOOP
    v_idx := v_idx + 1;
    INSERT INTO public.accounts_receivable_installments (
      account_id, installment_number, due_date, amount, payment_method
    ) VALUES (
      v_account_id,
      v_idx,
      (v_inst->>'due_date')::date,
      (v_inst->>'amount')::numeric,
      NULLIF(v_inst->>'payment_method', '')
    );
  END LOOP;

  RETURN v_account_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_receivable_from_order(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_receivable_from_order(uuid, jsonb) TO authenticated;