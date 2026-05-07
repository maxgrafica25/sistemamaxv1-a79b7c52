CREATE OR REPLACE FUNCTION public.create_quote_version(p_quote_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  v_new_version := v_old_quote.version + 1;

  INSERT INTO public.quotes (
    quote_number, client, product, value, status, date, validity,
    discount_value, discount_type, payment_method, options,
    version, parent_quote_id, profit_margin,
    client_id, client_phone, notes, attention_to,
    hidden_extras_value, freight_value, freight_type_id,
    tags, main_quantity
  ) VALUES (
    v_old_quote.quote_number,
    v_old_quote.client,
    v_old_quote.product,
    v_old_quote.value,
    'pending',
    CURRENT_DATE,
    v_old_quote.validity,
    v_old_quote.discount_value,
    v_old_quote.discount_type,
    v_old_quote.payment_method,
    v_old_quote.options,
    v_new_version,
    p_quote_id,
    v_old_quote.profit_margin,
    v_old_quote.client_id,
    v_old_quote.client_phone,
    v_old_quote.notes,
    v_old_quote.attention_to,
    v_old_quote.hidden_extras_value,
    v_old_quote.freight_value,
    v_old_quote.freight_type_id,
    v_old_quote.tags,
    v_old_quote.main_quantity
  )
  RETURNING id INTO v_new_id;

  INSERT INTO public.quote_materials (
    quote_id, description, quantity, unit_price, sort_order,
    status, approved_at, approved_value
  )
  SELECT v_new_id, description, quantity, unit_price, sort_order,
         status, approved_at, approved_value
    FROM public.quote_materials
   WHERE quote_id = p_quote_id;

  INSERT INTO public.quote_labor_steps (quote_id, description, time_minutes, sort_order)
  SELECT v_new_id, description, time_minutes, sort_order
    FROM public.quote_labor_steps
   WHERE quote_id = p_quote_id;

  UPDATE public.quotes
     SET is_locked = true, updated_at = now()
   WHERE id = p_quote_id;

  RETURN v_new_id;
END;
$$;