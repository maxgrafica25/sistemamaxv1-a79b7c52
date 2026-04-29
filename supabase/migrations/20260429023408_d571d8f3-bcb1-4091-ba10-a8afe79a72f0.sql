CREATE OR REPLACE FUNCTION public.register_quote_event(
  p_quote_id uuid,
  p_event_type text,
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_user_agent text DEFAULT NULL::text,
  p_visitor_id text DEFAULT NULL::text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_visit_number int := 1;
  v_meta jsonb;
  v_ip text;
  v_ip_hash text;
BEGIN
  -- ATENÇÃO CRÍTICA: ignora eventos de equipe interna
  IF v_uid IS NOT NULL THEN RETURN; END IF;

  IF p_event_type NOT IN
     ('viewed','printed','whatsapp_share','link_copied',
      'option_selected','option_deselected','scroll_depth')
  THEN RAISE EXCEPTION 'invalid event_type'; END IF;

  v_meta := COALESCE(p_metadata, '{}'::jsonb);

  -- Re-acesso: conta visitas distintas (por hora) deste visitor a este orçamento
  IF p_event_type = 'viewed' AND p_visitor_id IS NOT NULL THEN
    SELECT COUNT(DISTINCT date_trunc('hour', created_at))::int + 1
      INTO v_visit_number
      FROM public.quote_engagement_events
     WHERE quote_id = p_quote_id
       AND event_type = 'viewed'
       AND metadata->>'visitor_id' = p_visitor_id;
    v_meta := v_meta
      || jsonb_build_object('visit_number', v_visit_number);
  END IF;

  -- Sempre garantir visitor_id no metadata (necessário para detectar encaminhamento)
  IF p_visitor_id IS NOT NULL THEN
    v_meta := v_meta || jsonb_build_object('visitor_id', p_visitor_id);
  END IF;

  -- location_hint preparado (null por enquanto, futura edge function popula)
  v_meta := jsonb_set(v_meta, '{location_hint}',
              COALESCE(v_meta->'location_hint','null'::jsonb), true);

  -- ip_hash server-side: SHA-256 de IP + quote_id (não reversível, agrupa acessos)
  BEGIN
    v_ip := COALESCE(inet_client_addr()::text, '');
    IF v_ip <> '' THEN
      v_ip_hash := encode(extensions.digest(v_ip || p_quote_id::text, 'sha256'), 'hex');
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_ip_hash := NULL;
  END;

  INSERT INTO public.quote_engagement_events
    (quote_id, event_type, metadata, user_agent, ip_hash)
  VALUES (p_quote_id, p_event_type, v_meta, p_user_agent, v_ip_hash);

  -- Mantém compatibilidade com colunas legadas em quotes
  IF p_event_type = 'viewed' THEN
    UPDATE public.quotes
       SET view_count = COALESCE(view_count,0)+1,
           last_viewed_at = now()
     WHERE id = p_quote_id;
  END IF;
END; $function$;