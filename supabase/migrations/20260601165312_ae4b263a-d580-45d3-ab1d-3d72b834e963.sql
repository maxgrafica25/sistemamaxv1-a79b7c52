-- Revoke execute from public
REVOKE EXECUTE ON FUNCTION public.backup_get_foreign_keys() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.backup_get_policies() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.backup_get_tables() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.backup_get_functions() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.backup_get_triggers() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.backup_get_indexes() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.backup_get_cron_jobs() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.backup_get_realtime_publication() FROM PUBLIC;

-- Grant to service_role
GRANT EXECUTE ON FUNCTION public.backup_get_foreign_keys() TO service_role;
GRANT EXECUTE ON FUNCTION public.backup_get_policies() TO service_role;
GRANT EXECUTE ON FUNCTION public.backup_get_tables() TO service_role;
GRANT EXECUTE ON FUNCTION public.backup_get_functions() TO service_role;
GRANT EXECUTE ON FUNCTION public.backup_get_triggers() TO service_role;
GRANT EXECUTE ON FUNCTION public.backup_get_indexes() TO service_role;
GRANT EXECUTE ON FUNCTION public.backup_get_cron_jobs() TO service_role;
GRANT EXECUTE ON FUNCTION public.backup_get_realtime_publication() TO service_role;
