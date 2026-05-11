CREATE OR REPLACE FUNCTION public.approve_quote_items(p_quote_id uuid, p_item_ids uuid[])
RETURNS TABLE(approved_count integer, total_value numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_quote_locked boolean;
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
  v_type text;
  v_user record;
BEGIN
  SELECT is_locked INTO v_quote_locked FROM public.quotes WHERE id = p_quote_id;
  IF v_quote_locked IS NULL THEN
    RAISE EXCEPTION 'Orçamento não encontrado.';
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
       WHEN NOT EXISTS (
         SELECT 1 FROM public.quote_materials
          WHERE quote_id = q.id AND status = 'pendente'
       ) AND EXISTS (
         SELECT 1 FROM public.quote_materials
          WHERE quote_id = q.id AND status = 'aprovado'
       ) THEN 'approved'
       WHEN EXISTS (
         SELECT 1 FROM public.quote_materials
          WHERE quote_id = q.id AND status = 'aprovado'
       ) THEN 'partial'
       ELSE q.status
     END,
     updated_at = now()
   WHERE id = p_quote_id;

  -- Notificações para a equipe (somente se houve aprovação efetiva nesta chamada)
  IF v_count > 0 THEN
    SELECT quote_number, client, status INTO v_quote
      FROM public.quotes WHERE id = p_quote_id;

    -- Resumo dos itens aprovados nesta rodada (até 3 nomes)
    WITH picked AS (
      SELECT COALESCE(NULLIF(generated_title, ''), NULLIF(custom_name, ''), description) AS nome
        FROM public.quote_materials
       WHERE quote_id = p_quote_id
         AND id = ANY(p_item_ids)
         AND parent_item_id IS NULL
         AND status = 'aprovado'
       ORDER BY sort_order
    ), top3 AS (
      SELECT nome, row_number() OVER () AS rn FROM picked
    )
    SELECT
      string_agg(CASE WHEN rn <= 3 THEN nome END, ', ' ORDER BY rn)
        FILTER (WHERE rn <= 3),
      GREATEST(0, (SELECT count(*) FROM picked) - 3)
      INTO v_items_text, v_extra
      FROM top3;

    IF v_extra > 0 THEN
      v_items_text := v_items_text || ' e mais ' || v_extra;
    END IF;

    SELECT
      count(*) FILTER (WHERE parent_item_id IS NULL),
      count(*) FILTER (WHERE parent_item_id IS NULL AND status = 'aprovado')
      INTO v_root_total, v_root_approved
      FROM public.quote_materials
     WHERE quote_id = p_quote_id;

    v_is_full := v_quote.status = 'approved';

    IF v_is_full THEN
      v_title := 'Orçamento Nº ' || v_quote.quote_number || ' aprovado integralmente';
      v_type := 'success';
    ELSE
      v_title := 'Novo aceite — Orçamento Nº ' || v_quote.quote_number;
      v_type := 'info';
    END IF;

    v_msg := v_quote.client || ' aprovou ' || v_count || ' '
      || CASE WHEN v_count = 1 THEN 'item' ELSE 'itens' END
      || COALESCE(': ' || v_items_text, '')
      || '. Total acumulado aprovado: R$ '
      || replace(to_char(v_total, 'FM999G999G990D00'), ',', 'X')
      || ' (' || v_root_approved || ' de ' || v_root_total || ' itens).';
    v_msg := replace(replace(v_msg, '.', '#'), 'X', ',');
    v_msg := replace(v_msg, '#', '.');
    -- (formatação simples pt-BR: 1.234,56)

    FOR v_user IN SELECT user_id FROM public.profiles LOOP
      INSERT INTO public.notifications (user_id, title, message, type, source_type, source_id)
      VALUES (v_user.user_id, v_title, v_msg, v_type, 'quote_approval', p_quote_id);
    END LOOP;
  END IF;

  RETURN QUERY SELECT v_count, v_total;
END;
$function$;