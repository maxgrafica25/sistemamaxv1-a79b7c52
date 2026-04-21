CREATE OR REPLACE FUNCTION public.backup_get_cron_jobs()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, cron, pg_catalog
AS $$
DECLARE
  result jsonb;
BEGIN
  BEGIN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'jobname', jobname,
      'schedule', schedule,
      'command', command,
      'database', database,
      'username', username,
      'active', active
    ) ORDER BY jobname), '[]'::jsonb)
    INTO result
    FROM cron.job;
  EXCEPTION WHEN OTHERS THEN
    result := '[]'::jsonb;
  END;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.backup_get_realtime_publication()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  result jsonb;
BEGIN
  BEGIN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'pubname', pubname,
      'schemaname', schemaname,
      'tablename', tablename
    ) ORDER BY pubname, tablename), '[]'::jsonb)
    INTO result
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime';
  EXCEPTION WHEN OTHERS THEN
    result := '[]'::jsonb;
  END;
  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.backup_get_cron_jobs() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.backup_get_realtime_publication() TO authenticated, service_role;