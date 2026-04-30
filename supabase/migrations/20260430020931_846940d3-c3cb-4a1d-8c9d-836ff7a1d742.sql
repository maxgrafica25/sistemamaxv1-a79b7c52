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
  IF v_uid IS NOT NULL THEN RETURN; END IF;

  IF p_event_type NOT IN
     ('viewed','printed','whatsapp_share','link_copied',
      'option_selected','option_deselected','scroll_depth')
  THEN RAISE EXCEPTION 'invalid event_type'; END IF;

  v_meta := COALESCE(p_metadata, '{}'::jsonb);

  -- Contador crescente: total de "viewed" anteriores neste orçamento + 1.
  IF p_event_type = 'viewed' THEN
    SELECT COUNT(*)::int + 1
      INTO v_visit_number
      FROM public.quote_engagement_events
     WHERE quote_id = p_quote_id
       AND event_type = 'viewed';
    v_meta := v_meta || jsonb_build_object('visit_number', v_visit_number);
  END IF;

  IF p_visitor_id IS NOT NULL THEN
    v_meta := v_meta || jsonb_build_object('visitor_id', p_visitor_id);
  END IF;

  v_meta := jsonb_set(v_meta, '{location_hint}',
              COALESCE(v_meta->'location_hint','null'::jsonb), true);

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

  IF p_event_type = 'viewed' THEN
    UPDATE public.quotes
       SET view_count = COALESCE(view_count,0)+1,
           last_viewed_at = now()
     WHERE id = p_quote_id;
  END IF;
END; $function$;