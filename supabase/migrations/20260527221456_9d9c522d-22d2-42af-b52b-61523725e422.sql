-- Drop versão antiga (assinatura uuid quote_id)
DROP FUNCTION IF EXISTS public.register_quote_view(uuid);

-- Nova versão: token público + rate-limit
CREATE OR REPLACE FUNCTION public.register_quote_view(p_public_token uuid, p_visitor_id text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_quote_id uuid;
  v_rl_id text;
BEGIN
  -- Equipe interna autenticada não conta visualização pública
  IF auth.uid() IS NOT NULL THEN
    RETURN;
  END IF;

  IF p_public_token IS NULL THEN
    RAISE EXCEPTION 'public_token obrigatório';
  END IF;

  SELECT id INTO v_quote_id
    FROM public.quotes
   WHERE public_token = p_public_token
   LIMIT 1;

  IF v_quote_id IS NULL THEN
    BEGIN
      INSERT INTO public.audit_logs (action, entity_type, entity_id, entity_name, details)
      VALUES ('public_quote_view_invalid_token', 'quote', NULL, NULL,
              'Tentativa de view com token inválido: ' || p_public_token::text);
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
    RETURN;
  END IF;

  -- Rate-limit: 10 views/min por visitor+token
  v_rl_id := COALESCE(p_visitor_id, 'anon') || ':' || p_public_token::text;
  IF NOT public.check_rate_limit(v_rl_id, 'register_quote_view', 10, 60) THEN
    RETURN;
  END IF;

  UPDATE public.quotes
     SET view_count = COALESCE(view_count, 0) + 1,
         last_viewed_at = now()
   WHERE id = v_quote_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.register_quote_view(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_quote_view(uuid, text) TO anon, authenticated;

-- Remove o bump de view_count/last_viewed_at de register_quote_event
-- (agora é responsabilidade exclusiva de register_quote_view, evita double-count)
CREATE OR REPLACE FUNCTION public.register_quote_event(
  p_public_token uuid,
  p_event_type text,
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_user_agent text DEFAULT NULL,
  p_visitor_id text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_quote_id uuid;
  v_visit_number int := 1;
  v_meta jsonb;
  v_ip text;
  v_ip_hash text;
  v_rl_id text;
BEGIN
  IF v_uid IS NOT NULL THEN RETURN; END IF;

  IF p_public_token IS NULL THEN
    RAISE EXCEPTION 'public_token obrigatório';
  END IF;

  IF p_event_type NOT IN
     ('viewed','printed','whatsapp_share','link_copied',
      'option_selected','option_deselected',
      'item_selected','item_deselected',
      'scroll_depth')
  THEN
    RAISE EXCEPTION 'invalid event_type';
  END IF;

  SELECT id INTO v_quote_id
    FROM public.quotes
   WHERE public_token = p_public_token
   LIMIT 1;

  IF v_quote_id IS NULL THEN
    BEGIN
      INSERT INTO public.audit_logs (action, entity_type, entity_id, entity_name, details)
      VALUES ('public_quote_event_invalid_token', 'quote', NULL, NULL,
              'Tentativa de evento com token inválido: ' || p_public_token::text);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    RETURN;
  END IF;

  v_rl_id := COALESCE(p_visitor_id, 'anon') || ':' || p_public_token::text;
  IF NOT public.check_rate_limit(v_rl_id, 'register_quote_event', 60, 60) THEN
    RETURN;
  END IF;

  v_meta := COALESCE(p_metadata, '{}'::jsonb);

  IF p_event_type = 'viewed' THEN
    SELECT COUNT(*)::int + 1
      INTO v_visit_number
      FROM public.quote_engagement_events
     WHERE quote_id = v_quote_id
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
      v_ip_hash := encode(extensions.digest(v_ip || v_quote_id::text, 'sha256'), 'hex');
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_ip_hash := NULL;
  END;

  INSERT INTO public.quote_engagement_events
    (quote_id, event_type, metadata, user_agent, ip_hash)
  VALUES (v_quote_id, p_event_type, v_meta, p_user_agent, v_ip_hash);

  -- NOTA: view_count/last_viewed_at agora atualizados via register_quote_view
END;
$function$;