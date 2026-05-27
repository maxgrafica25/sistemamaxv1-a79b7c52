
-- =========================================================
-- MIGRATION D: Catálogos globais read-only
-- =========================================================
DROP POLICY IF EXISTS "Authenticated can read printer_categories"   ON public.printer_categories;
DROP POLICY IF EXISTS "Authenticated can insert printer_categories" ON public.printer_categories;
DROP POLICY IF EXISTS "Authenticated can update printer_categories" ON public.printer_categories;
DROP POLICY IF EXISTS "Authenticated can delete printer_categories" ON public.printer_categories;
DROP POLICY IF EXISTS "Allow all access to printer_categories"      ON public.printer_categories;

CREATE POLICY "printer_categories_read_authenticated"
  ON public.printer_categories FOR SELECT TO authenticated USING (true);

REVOKE INSERT, UPDATE, DELETE ON public.printer_categories FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.printer_categories FROM anon;
GRANT  SELECT ON public.printer_categories TO authenticated;
GRANT  ALL    ON public.printer_categories TO service_role;

DROP POLICY IF EXISTS "Authenticated can read global_settings"   ON public.global_settings;
DROP POLICY IF EXISTS "Authenticated can update global_settings" ON public.global_settings;
DROP POLICY IF EXISTS "Authenticated can insert global_settings" ON public.global_settings;
DROP POLICY IF EXISTS "Authenticated can delete global_settings" ON public.global_settings;

CREATE POLICY "global_settings_read_authenticated"
  ON public.global_settings FOR SELECT TO authenticated USING (true);

REVOKE INSERT, UPDATE, DELETE ON public.global_settings FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.global_settings FROM anon;
GRANT  SELECT ON public.global_settings TO authenticated;
GRANT  ALL    ON public.global_settings TO service_role;

COMMENT ON TABLE public.printer_categories IS
  'Catálogo global read-only. Mutações apenas via service_role.';
COMMENT ON TABLE public.global_settings IS
  'Configurações globais read-only. Mutações apenas via service_role.';

-- =========================================================
-- MIGRATION F (antes de E): rate limiting
-- =========================================================

-- 1) whitelist ANTES do CREATE TABLE (event trigger valida no DDL)
INSERT INTO public.tenant_enforcement_whitelist (table_name, reason)
VALUES ('rate_limits', 'Tabela global de rate limiting (sem tenant)')
ON CONFLICT (table_name) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.rate_limits (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier   text NOT NULL,
  action       text NOT NULL,
  window_start timestamptz NOT NULL DEFAULT now(),
  request_count integer NOT NULL DEFAULT 1,
  created_at   timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.rate_limits TO service_role;

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS rate_limits_lookup_idx
  ON public.rate_limits (identifier, action, window_start DESC);

CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_identifier     text,
  p_action         text,
  p_max_requests   integer,
  p_window_seconds integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window_start timestamptz := now() - make_interval(secs => p_window_seconds);
  v_count integer;
BEGIN
  IF p_identifier IS NULL OR btrim(p_identifier) = '' THEN
    RETURN true;
  END IF;

  DELETE FROM public.rate_limits
   WHERE action = p_action
     AND window_start < (now() - make_interval(secs => GREATEST(p_window_seconds * 4, 3600)));

  SELECT COALESCE(SUM(request_count), 0)::int INTO v_count
    FROM public.rate_limits
   WHERE identifier = p_identifier
     AND action = p_action
     AND window_start >= v_window_start;

  IF v_count >= p_max_requests THEN
    RETURN false;
  END IF;

  INSERT INTO public.rate_limits (identifier, action, request_count)
  VALUES (p_identifier, p_action, 1);

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.check_rate_limit(text,text,integer,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(text,text,integer,integer)
  TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.check_rate_limit(text,text,integer,integer) IS
  'Rate limit por (identifier, action). Retorna true se dentro do limite e registra; false se excedido.';

-- =========================================================
-- MIGRATION E: register_quote_event por public_token
-- =========================================================
DROP FUNCTION IF EXISTS public.register_quote_event(uuid, text, jsonb, text, text);

CREATE OR REPLACE FUNCTION public.register_quote_event(
  p_public_token uuid,
  p_event_type   text,
  p_metadata     jsonb DEFAULT '{}'::jsonb,
  p_user_agent   text  DEFAULT NULL,
  p_visitor_id   text  DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
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

  IF p_event_type = 'viewed' THEN
    UPDATE public.quotes
       SET view_count = COALESCE(view_count,0)+1,
           last_viewed_at = now()
     WHERE id = v_quote_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.register_quote_event(uuid,text,jsonb,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_quote_event(uuid,text,jsonb,text,text)
  TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.register_quote_event(uuid,text,jsonb,text,text) IS
  'Eventos da página pública do orçamento. Recebe public_token (UUID) e aplica rate limit por visitor.';
