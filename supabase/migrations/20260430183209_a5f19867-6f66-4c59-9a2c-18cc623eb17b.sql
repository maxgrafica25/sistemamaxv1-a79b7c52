CREATE OR REPLACE FUNCTION public.delete_quotes_bulk(p_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_quote record;
  v_has_child boolean;
  v_deleted int := 0;
  v_skipped jsonb := '[]'::jsonb;
BEGIN
  IF NOT public.is_profile_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas administradores podem excluir orçamentos.';
  END IF;

  IF p_ids IS NULL OR array_length(p_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'Nenhum orçamento selecionado.';
  END IF;

  FOREACH v_id IN ARRAY p_ids LOOP
    SELECT id, quote_number, is_locked INTO v_quote FROM public.quotes WHERE id = v_id;
    IF v_quote.id IS NULL THEN
      v_skipped := v_skipped || jsonb_build_object('id', v_id, 'reason', 'não encontrado');
      CONTINUE;
    END IF;

    IF v_quote.is_locked THEN
      v_skipped := v_skipped || jsonb_build_object('id', v_id, 'number', v_quote.quote_number, 'reason', 'orçamento travado (possui versão mais recente)');
      CONTINUE;
    END IF;

    SELECT EXISTS(SELECT 1 FROM public.quotes WHERE parent_quote_id = v_id) INTO v_has_child;
    IF v_has_child THEN
      v_skipped := v_skipped || jsonb_build_object('id', v_id, 'number', v_quote.quote_number, 'reason', 'possui versão filha vinculada');
      CONTINUE;
    END IF;

    DELETE FROM public.quote_engagement_events WHERE quote_id = v_id;
    DELETE FROM public.quote_materials WHERE quote_id = v_id;
    DELETE FROM public.quote_labor_steps WHERE quote_id = v_id;
    DELETE FROM public.quote_third_party WHERE quote_id = v_id;
    DELETE FROM public.quote_reminders WHERE quote_id = v_id;
    DELETE FROM public.quotes WHERE id = v_id;

    INSERT INTO public.audit_logs (action, entity_type, entity_id, entity_name, details)
    VALUES ('delete_quote', 'quote', v_id::text, v_quote.quote_number,
            'Orçamento excluído por ' || COALESCE(auth.uid()::text, 'desconhecido'));

    v_deleted := v_deleted + 1;
  END LOOP;

  RETURN jsonb_build_object('deleted_count', v_deleted, 'skipped', v_skipped);
END;
$$;