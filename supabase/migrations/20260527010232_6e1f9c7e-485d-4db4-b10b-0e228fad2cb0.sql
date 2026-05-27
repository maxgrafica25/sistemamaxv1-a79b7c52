
-- Tabela de mensagens da Júlia (histórico persistido no servidor — anti-spoof)
CREATE TABLE public.assistente_mensagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('user','assistant')),
  content text NOT NULL CHECK (length(content) <= 8000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX assistente_mensagens_user_created_idx
  ON public.assistente_mensagens (user_id, created_at DESC);

GRANT SELECT ON public.assistente_mensagens TO authenticated;
GRANT ALL    ON public.assistente_mensagens TO service_role;

ALTER TABLE public.assistente_mensagens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner reads own messages"
  ON public.assistente_mensagens FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Tabela de auditoria (só admin lê, sem prompt cru)
CREATE TABLE public.assistente_auditoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  pergunta_hash text NOT NULL,
  pergunta_chars int NOT NULL DEFAULT 0,
  suspicious boolean NOT NULL DEFAULT false,
  pii_redacted_count int NOT NULL DEFAULT 0,
  tools_called text[],
  latency_ms int,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX assistente_auditoria_created_idx
  ON public.assistente_auditoria (created_at DESC);

GRANT SELECT ON public.assistente_auditoria TO authenticated;
GRANT ALL    ON public.assistente_auditoria TO service_role;

ALTER TABLE public.assistente_auditoria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin reads audit"
  ON public.assistente_auditoria FOR SELECT
  TO authenticated
  USING (public.is_profile_admin(auth.uid()));

-- RPC de rate-limit derivado da própria tabela de mensagens.
-- Conta perguntas do usuário nas janelas; retorna (allowed, count_5min, count_day, reset_at).
CREATE OR REPLACE FUNCTION public.assistente_check_rate_limit(
  p_user_id uuid,
  p_max_5min int DEFAULT 20,
  p_max_day  int DEFAULT 200
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_5min int;
  v_day  int;
BEGIN
  SELECT count(*) INTO v_5min
    FROM public.assistente_mensagens
   WHERE user_id = p_user_id
     AND role = 'user'
     AND created_at > now() - interval '5 minutes';

  SELECT count(*) INTO v_day
    FROM public.assistente_mensagens
   WHERE user_id = p_user_id
     AND role = 'user'
     AND created_at > now() - interval '1 day';

  RETURN jsonb_build_object(
    'allowed', (v_5min < p_max_5min AND v_day < p_max_day),
    'count_5min', v_5min,
    'count_day',  v_day,
    'max_5min',   p_max_5min,
    'max_day',    p_max_day
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.assistente_check_rate_limit(uuid, int, int) TO service_role;
