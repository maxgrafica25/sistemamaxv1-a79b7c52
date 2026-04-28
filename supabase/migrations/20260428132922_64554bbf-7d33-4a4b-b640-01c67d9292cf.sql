-- 1. Tabela de eventos de engajamento
CREATE TABLE public.quote_engagement_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN
    ('viewed','printed','whatsapp_share','link_copied',
     'option_selected','scroll_depth')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  user_agent text,
  ip_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_qee_quote_created ON public.quote_engagement_events (quote_id, created_at DESC);
CREATE INDEX idx_qee_quote_type ON public.quote_engagement_events (quote_id, event_type);

ALTER TABLE public.quote_engagement_events ENABLE ROW LEVEL SECURITY;

-- Equipe (autenticados) lê tudo
CREATE POLICY "Authenticated read engagement events"
  ON public.quote_engagement_events FOR SELECT
  TO authenticated USING (true);

-- Sem policy de INSERT/UPDATE/DELETE: anon escreve só via RPC SECURITY DEFINER

-- Adiciona à publication realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.quote_engagement_events;

-- 2. Coluna client_phone em quotes
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS client_phone text;

-- 3. RPC com filtro rigoroso de equipe + cálculo de visit_number
CREATE OR REPLACE FUNCTION public.register_quote_event(
  p_quote_id   uuid,
  p_event_type text,
  p_metadata   jsonb DEFAULT '{}'::jsonb,
  p_user_agent text DEFAULT NULL,
  p_visitor_id text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_visit_number int := 1;
  v_meta jsonb;
BEGIN
  -- ATENÇÃO CRÍTICA: ignora eventos de equipe interna
  IF v_uid IS NOT NULL THEN RETURN; END IF;

  IF p_event_type NOT IN
     ('viewed','printed','whatsapp_share','link_copied',
      'option_selected','scroll_depth')
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
      || jsonb_build_object('visit_number', v_visit_number)
      || jsonb_build_object('visitor_id', p_visitor_id);
  END IF;

  -- location_hint preparado (null por enquanto, futura edge function popula)
  v_meta := jsonb_set(v_meta, '{location_hint}',
              COALESCE(v_meta->'location_hint','null'::jsonb), true);

  INSERT INTO public.quote_engagement_events
    (quote_id, event_type, metadata, user_agent)
  VALUES (p_quote_id, p_event_type, v_meta, p_user_agent);

  -- Mantém compatibilidade com colunas legadas em quotes
  IF p_event_type = 'viewed' THEN
    UPDATE public.quotes
       SET view_count = COALESCE(view_count,0)+1,
           last_viewed_at = now()
     WHERE id = p_quote_id;
  END IF;
END; $$;

GRANT EXECUTE ON FUNCTION public.register_quote_event(uuid,text,jsonb,text,text)
  TO anon, authenticated;