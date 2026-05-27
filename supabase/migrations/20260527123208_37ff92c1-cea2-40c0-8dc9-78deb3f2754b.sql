-- Migration 6 — Token público não-adivinhável para orçamentos
-- Fecha vazamento de orçamentos entre clientes finais (URLs /p/:quote_number eram sequenciais).

-- 1) Adicionar coluna public_token
ALTER TABLE public.quotes
  ADD COLUMN public_token uuid NOT NULL DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX IF NOT EXISTS quotes_public_token_uidx
  ON public.quotes(public_token);

-- 2) Substituir RPC get_public_quote: agora exige UUID (token)
DROP FUNCTION IF EXISTS public.get_public_quote(text, uuid);
DROP FUNCTION IF EXISTS public.get_public_quote(uuid);

CREATE OR REPLACE FUNCTION public.get_public_quote(p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_quote record;
  v_materials jsonb;
  v_labor jsonb;
  v_cv jsonb;
BEGIN
  IF p_token IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT id, quote_number, client, product, value, status, date, validity,
         discount_value, discount_type, payment_method, options, version, is_locked
    INTO v_quote
    FROM public.quotes
   WHERE public_token = p_token
   LIMIT 1;

  IF v_quote.id IS NULL THEN
    -- Auditoria: tentativa de acesso com token inválido (possível enumeração)
    BEGIN
      INSERT INTO public.audit_logs (action, entity_type, entity_id, entity_name, details)
      VALUES ('public_quote_invalid_token', 'quote', NULL, NULL,
              'Tentativa de acesso público com token inexistente: ' || p_token::text);
    EXCEPTION WHEN OTHERS THEN
      -- nunca falha o retorno por causa de auditoria
      NULL;
    END;
    RETURN NULL;
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', id, 'description', description, 'quantity', quantity,
    'unit_price', unit_price, 'sort_order', sort_order, 'status', status,
    'approved_at', approved_at, 'approved_value', approved_value,
    'parent_item_id', parent_item_id, 'generated_title', generated_title,
    'reference', reference, 'tier_group_id', tier_group_id
  ) ORDER BY sort_order), '[]'::jsonb)
    INTO v_materials
    FROM public.quote_materials
   WHERE quote_id = v_quote.id AND parent_item_id IS NULL;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', id, 'description', description, 'time_minutes', time_minutes,
    'parent_item_id', parent_item_id
  )), '[]'::jsonb)
    INTO v_labor
    FROM public.quote_labor_steps
   WHERE quote_id = v_quote.id;

  -- cv_items (mesmo formato anterior, se a tabela existir)
  BEGIN
    SELECT COALESCE(jsonb_agg(to_jsonb(c.*)), '[]'::jsonb)
      INTO v_cv
      FROM public.cv_calc_quote_items c
     WHERE c.quote_id = v_quote.id;
  EXCEPTION WHEN undefined_table THEN
    v_cv := '[]'::jsonb;
  END;

  RETURN jsonb_build_object(
    'quote', to_jsonb(v_quote),
    'materials', v_materials,
    'labor', v_labor,
    'cv_items', COALESCE(v_cv, '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_quote(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_quote(uuid) TO anon, authenticated;