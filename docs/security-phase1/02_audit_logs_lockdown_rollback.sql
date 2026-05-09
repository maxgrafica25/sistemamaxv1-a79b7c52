-- Rollback do item 2
BEGIN;

DROP POLICY IF EXISTS "Only admins read audit_logs" ON public.audit_logs;

CREATE POLICY "Authenticated can read audit_logs"
  ON public.audit_logs FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert audit_logs"
  ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Anon can insert password reset audit"
  ON public.audit_logs FOR INSERT TO anon
  WITH CHECK (entity_type = 'auth' AND action LIKE 'password_reset_%');

REVOKE EXECUTE ON FUNCTION public.log_audit_event(text,text,text,text,text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.log_auth_event(text,text,text)             FROM anon, authenticated;
DROP FUNCTION IF EXISTS public.log_audit_event(text,text,text,text,text);
DROP FUNCTION IF EXISTS public.log_auth_event(text,text,text);

COMMIT;
