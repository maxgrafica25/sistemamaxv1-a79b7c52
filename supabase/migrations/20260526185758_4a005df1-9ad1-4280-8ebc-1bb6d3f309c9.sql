
-- Fechar leitura anônima direta nas tabelas de orçamento e oferecer um único
-- RPC SECURITY DEFINER que devolve apenas o payload necessário para o
-- visualizador público (sem profit_margin, sem v3_payload, sem terceiros).

CREATE OR REPLACE FUNCTION public.get_public_quote(
  p_quote_number text DEFAULT NULL,
  p_quote_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quote record;
  v_materials jsonb;
  v_labor jsonb;
  v_cv jsonb;
BEGIN
  IF p_quote_number IS NULL AND p_quote_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF p_quote_number IS NOT NULL THEN
    SELECT id, quote_number, client, product, value, status, date, validity,
           discount_value, discount_type, payment_method, options, version, is_locked
      INTO v_quote
      FROM public.quotes
     WHERE quote_number = p_quote_number
     ORDER BY version DESC
     LIMIT 1;
  ELSE
    SELECT id, quote_number, client, product, value, status, date, validity,
           discount_value, discount_type, payment_method, options, version, is_locked
      INTO v_quote
      FROM public.quotes
     WHERE id = p_quote_id;
  END IF;

  IF v_quote.id IS NULL THEN
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
    'sort_order', sort_order, 'parent_item_id', parent_item_id
  ) ORDER BY sort_order), '[]'::jsonb)
    INTO v_labor
    FROM public.quote_labor_steps
   WHERE quote_id = v_quote.id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', id, 'material_nome', material_nome, 'printer_nome', printer_nome,
    'largura_cm', largura_cm, 'altura_cm', altura_cm, 'quantidade', quantidade,
    'preco_total', preco_total, 'tem_emenda', tem_emenda,
    'aplicou_minimo', aplicou_minimo, 'sort_order', sort_order,
    'finishes_json', finishes_json
  ) ORDER BY sort_order), '[]'::jsonb)
    INTO v_cv
    FROM public.cv_quote_items
   WHERE quote_id = v_quote.id;

  RETURN jsonb_build_object(
    'quote', to_jsonb(v_quote),
    'materials', v_materials,
    'labor', v_labor,
    'cv_items', v_cv
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_quote(text, uuid) TO anon, authenticated;

-- Remover SELECT anônimo nas tabelas — visualizador público passa a usar a RPC.
DROP POLICY IF EXISTS "Public can read quote by id" ON public.quotes;
DROP POLICY IF EXISTS "Public can read quote_materials" ON public.quote_materials;
DROP POLICY IF EXISTS "Public can read quote_labor_steps" ON public.quote_labor_steps;
DROP POLICY IF EXISTS "Public can read cv_quote_items" ON public.cv_quote_items;
DROP POLICY IF EXISTS "Public can read quote_third_party" ON public.quote_third_party;
