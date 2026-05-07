-- 1) Reescreve create_quote_version preservando metadados e hierarquia
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

  -- Mapeamento old_id -> new_id para remapear parent_item_id
  CREATE TEMP TABLE _qm_map(old_id uuid PRIMARY KEY, new_id uuid NOT NULL) ON COMMIT DROP;

  -- 1) Inserir materiais raiz (parent_item_id IS NULL)
  WITH src AS (
    SELECT id AS old_id, gen_random_uuid() AS new_id, *
      FROM public.quote_materials
     WHERE quote_id = p_quote_id AND parent_item_id IS NULL
  ),
  ins AS (
    INSERT INTO public.quote_materials (
      id, quote_id, description, quantity, unit_price, sort_order,
      status, approved_at, approved_value, parent_item_id,
      product_kind, custom_name, reference, generated_title,
      paper_type, grammage, size, side,
      catalog_source, catalog_item_id
    )
    SELECT s.new_id, v_new_id, s.description, s.quantity, s.unit_price, s.sort_order,
           s.status, s.approved_at, s.approved_value, NULL,
           s.product_kind, s.custom_name, s.reference, s.generated_title,
           s.paper_type, s.grammage, s.size, s.side,
           s.catalog_source, s.catalog_item_id
      FROM src s
    RETURNING id
  )
  INSERT INTO _qm_map(old_id, new_id)
  SELECT old_id, new_id FROM src;

  -- 2) Inserir materiais filhos com parent remapeado
  INSERT INTO public.quote_materials (
    quote_id, description, quantity, unit_price, sort_order,
    status, approved_at, approved_value, parent_item_id,
    product_kind, custom_name, reference, generated_title,
    paper_type, grammage, size, side,
    catalog_source, catalog_item_id
  )
  SELECT v_new_id, m.description, m.quantity, m.unit_price, m.sort_order,
         m.status, m.approved_at, m.approved_value, mp.new_id,
         m.product_kind, m.custom_name, m.reference, m.generated_title,
         m.paper_type, m.grammage, m.size, m.side,
         m.catalog_source, m.catalog_item_id
    FROM public.quote_materials m
    JOIN _qm_map mp ON mp.old_id = m.parent_item_id
   WHERE m.quote_id = p_quote_id AND m.parent_item_id IS NOT NULL;

  -- 3) Labor steps com parent remapeado e step_type
  INSERT INTO public.quote_labor_steps (
    quote_id, description, time_minutes, sort_order, parent_item_id, step_type
  )
  SELECT v_new_id, l.description, l.time_minutes, l.sort_order,
         mp.new_id, l.step_type
    FROM public.quote_labor_steps l
    LEFT JOIN _qm_map mp ON mp.old_id = l.parent_item_id
   WHERE l.quote_id = p_quote_id;

  UPDATE public.quotes SET is_locked = true, updated_at = now() WHERE id = p_quote_id;

  RETURN v_new_id;
END;
$function$;

-- 2) Backfill da versão v2 do 2026-010 (4217b83e-...) usando dados da v1 (b23e4d0f-...)
-- Atualiza materiais por sort_order
UPDATE public.quote_materials new_m
   SET product_kind   = old_m.product_kind,
       custom_name    = old_m.custom_name,
       reference      = old_m.reference,
       generated_title= old_m.generated_title,
       paper_type     = old_m.paper_type,
       grammage       = old_m.grammage,
       size           = old_m.size,
       side           = old_m.side,
       catalog_source = old_m.catalog_source,
       catalog_item_id= old_m.catalog_item_id
  FROM public.quote_materials old_m
 WHERE new_m.quote_id = '4217b83e-215a-41e9-8474-5984c1733ca2'
   AND old_m.quote_id = 'b23e4d0f-19b7-4840-978c-5e988fe6744a'
   AND old_m.parent_item_id IS NULL
   AND new_m.parent_item_id IS NULL
   AND new_m.sort_order = old_m.sort_order;

-- Re-vincula labor_steps da v2 aos materiais da v2 (mapeando via sort_order do material da v1)
UPDATE public.quote_labor_steps new_l
   SET parent_item_id = new_m.id,
       step_type      = old_l.step_type
  FROM public.quote_labor_steps old_l
  JOIN public.quote_materials old_m ON old_m.id = old_l.parent_item_id
  JOIN public.quote_materials new_m
    ON new_m.quote_id = '4217b83e-215a-41e9-8474-5984c1733ca2'
   AND new_m.sort_order = old_m.sort_order
   AND new_m.parent_item_id IS NULL
 WHERE new_l.quote_id = '4217b83e-215a-41e9-8474-5984c1733ca2'
   AND old_l.quote_id = 'b23e4d0f-19b7-4840-978c-5e988fe6744a'
   AND new_l.sort_order = old_l.sort_order
   AND new_l.description = old_l.description;