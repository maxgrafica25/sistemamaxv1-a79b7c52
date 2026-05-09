-- =============================================================================
-- Fase 1 / Item 2 — audit_logs: restringir SELECT/INSERT (ALTA)
-- =============================================================================
-- PRÉ-REQUISITO: src/lib/audit.ts deve estar refatorado para usar
-- as funções RPC log_audit_event() / log_auth_event() ANTES de aplicar este
-- script. Caso contrário, todos os INSERTs do frontend vão começar a falhar.
-- =============================================================================

BEGIN;

-- 1. Funções RPC para o frontend gravar audit sem ter INSERT direto na tabela.
--    SECURITY DEFINER + checagem de auth.uid() = autor.
CREATE OR REPLACE FUNCTION public.log_audit_event(
  p_action text,
  p_entity_type text,
  p_entity_id text DEFAULT NULL,
  p_entity_name text DEFAULT NULL,
  p_details text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'log_audit_event requires authenticated user';
  END IF;

  -- limites defensivos para evitar flooding
  IF length(coalesce(p_action,'')) > 100
     OR length(coalesce(p_entity_type,'')) > 100
     OR length(coalesce(p_entity_id,'')) > 200
     OR length(coalesce(p_entity_name,'')) > 500
     OR length(coalesce(p_details,'')) > 4000 THEN
    RAISE EXCEPTION 'log_audit_event payload too large';
  END IF;

  INSERT INTO public.audit_logs (action, entity_type, entity_id, entity_name, details)
  VALUES (p_action, p_entity_type, p_entity_id, p_entity_name, p_details);
END;
$$;

-- 2. Função para eventos de auth (anônimo permitido APENAS para password_reset_*)
CREATE OR REPLACE FUNCTION public.log_auth_event(
  p_action text,
  p_entity_name text DEFAULT NULL,
  p_details text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_action NOT LIKE 'password_reset_%' THEN
    RAISE EXCEPTION 'log_auth_event only accepts password_reset_* actions';
  END IF;

  IF length(coalesce(p_entity_name,'')) > 500
     OR length(coalesce(p_details,'')) > 4000 THEN
    RAISE EXCEPTION 'log_auth_event payload too large';
  END IF;

  INSERT INTO public.audit_logs (action, entity_type, entity_name, details)
  VALUES (p_action, 'auth', p_entity_name, p_details);
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_audit_event(text,text,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_auth_event(text,text,text)             TO anon, authenticated;

-- 3. Endurecer policies da tabela
DROP POLICY IF EXISTS "Authenticated can insert audit_logs"          ON public.audit_logs;
DROP POLICY IF EXISTS "Anon can insert password reset audit"         ON public.audit_logs;
DROP POLICY IF EXISTS "Authenticated can read audit_logs"            ON public.audit_logs;

CREATE POLICY "Only admins read audit_logs"
  ON public.audit_logs FOR SELECT
  TO authenticated
  USING (public.is_profile_admin(auth.uid()));

-- INSERT é proibido para qualquer role; apenas SECURITY DEFINER funcs gravam.
-- A policy de DELETE existente "Only admins can delete audit_logs" continua válida.

COMMIT;
