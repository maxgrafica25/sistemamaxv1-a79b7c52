-- 1. Enable RLS on auth_attempts
ALTER TABLE public.auth_attempts ENABLE ROW LEVEL SECURITY;

-- 2. Add policy for service_role on auth_attempts
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'auth_attempts' AND policyname = 'Service role can do everything on auth_attempts'
    ) THEN
        CREATE POLICY "Service role can do everything on auth_attempts"
        ON public.auth_attempts
        FOR ALL
        TO service_role
        USING (true)
        WITH CHECK (true);
    END IF;
END $$;

-- 3. Fix admin_operations_log policy
DROP POLICY IF EXISTS "Service role can insert admin_operations_log" ON public.admin_operations_log;
CREATE POLICY "Service role can insert admin_operations_log"
  ON public.admin_operations_log FOR INSERT
  TO service_role
  WITH CHECK (true);

-- 4. Set search_path for SECURITY DEFINER functions that lack it
ALTER FUNCTION public.enforce_tenant_column() SET search_path = public;
ALTER FUNCTION public.backup_get_foreign_keys() SET search_path = public;
ALTER FUNCTION public.backup_get_policies() SET search_path = public;
ALTER FUNCTION public.backup_get_tables() SET search_path = public;
ALTER FUNCTION public.backup_get_functions() SET search_path = public;
ALTER FUNCTION public.backup_get_triggers() SET search_path = public;
ALTER FUNCTION public.backup_get_indexes() SET search_path = public;
ALTER FUNCTION public.backup_get_cron_jobs() SET search_path = public;
ALTER FUNCTION public.backup_get_realtime_publication() SET search_path = public;
ALTER FUNCTION public.register_quote_event(uuid, text, jsonb, text, text) SET search_path = public;
ALTER FUNCTION public.verificar_permissao(uuid, text) SET search_path = public;
ALTER FUNCTION public.check_auth_rate_limit(text) SET search_path = public;
ALTER FUNCTION public.register_quote_view(uuid, text) SET search_path = public;
