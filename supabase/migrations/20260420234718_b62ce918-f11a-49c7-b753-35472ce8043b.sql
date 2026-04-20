-- Histórico de backups
CREATE TABLE public.backup_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  format text NOT NULL CHECK (format IN ('sql','json')),
  size_bytes bigint NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'success' CHECK (status IN ('success','failed')),
  error_message text
);

ALTER TABLE public.backup_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view backup_runs"
  ON public.backup_runs
  FOR SELECT
  TO authenticated
  USING (public.is_profile_admin(auth.uid()));

CREATE POLICY "Service inserts backup_runs"
  ON public.backup_runs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Helpers de introspecção (SECURITY DEFINER, restritos a service_role)
CREATE OR REPLACE FUNCTION public.backup_get_tables()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT COALESCE(jsonb_agg(t ORDER BY t->>'table_name'), '[]'::jsonb) FROM (
    SELECT jsonb_build_object(
      'table_name', c.table_name,
      'columns', (
        SELECT jsonb_agg(jsonb_build_object(
          'name', col.column_name,
          'data_type', col.data_type,
          'udt_name', col.udt_name,
          'is_nullable', col.is_nullable,
          'column_default', col.column_default,
          'character_maximum_length', col.character_maximum_length,
          'ordinal_position', col.ordinal_position
        ) ORDER BY col.ordinal_position)
        FROM information_schema.columns col
        WHERE col.table_schema = 'public' AND col.table_name = c.table_name
      ),
      'primary_key', (
        SELECT jsonb_agg(kcu.column_name ORDER BY kcu.ordinal_position)
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
         AND tc.table_schema = kcu.table_schema
        WHERE tc.table_schema = 'public'
          AND tc.table_name = c.table_name
          AND tc.constraint_type = 'PRIMARY KEY'
      )
    ) AS t
    FROM information_schema.tables c
    WHERE c.table_schema = 'public' AND c.table_type = 'BASE TABLE'
  ) sub;
$$;

CREATE OR REPLACE FUNCTION public.backup_get_functions()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'name', p.proname,
    'definition', pg_get_functiondef(p.oid)
  ) ORDER BY p.proname), '[]'::jsonb)
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.prokind = 'f';
$$;

CREATE OR REPLACE FUNCTION public.backup_get_triggers()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'name', t.tgname,
    'table', c.relname,
    'definition', pg_get_triggerdef(t.oid)
  ) ORDER BY c.relname, t.tgname), '[]'::jsonb)
  FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND NOT t.tgisinternal;
$$;

CREATE OR REPLACE FUNCTION public.backup_get_policies()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'schemaname', schemaname,
    'tablename', tablename,
    'policyname', policyname,
    'permissive', permissive,
    'roles', roles,
    'cmd', cmd,
    'qual', qual,
    'with_check', with_check
  ) ORDER BY tablename, policyname), '[]'::jsonb)
  FROM pg_policies
  WHERE schemaname = 'public';
$$;

CREATE OR REPLACE FUNCTION public.backup_get_indexes()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'tablename', i.tablename,
    'indexname', i.indexname,
    'indexdef', i.indexdef
  ) ORDER BY i.tablename, i.indexname), '[]'::jsonb)
  FROM pg_indexes i
  WHERE i.schemaname = 'public'
    AND NOT EXISTS (
      SELECT 1 FROM pg_constraint con
      JOIN pg_class c ON c.oid = con.conrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = i.tablename
        AND con.conname = i.indexname
        AND con.contype IN ('p','u')
    );
$$;

CREATE OR REPLACE FUNCTION public.backup_get_foreign_keys()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'constraint_name', con.conname,
    'table_name', cl.relname,
    'columns', (
      SELECT jsonb_agg(att.attname ORDER BY u.ord)
      FROM unnest(con.conkey) WITH ORDINALITY u(attnum, ord)
      JOIN pg_attribute att ON att.attrelid = cl.oid AND att.attnum = u.attnum
    ),
    'foreign_table', fcl.relname,
    'foreign_columns', (
      SELECT jsonb_agg(att.attname ORDER BY u.ord)
      FROM unnest(con.confkey) WITH ORDINALITY u(attnum, ord)
      JOIN pg_attribute att ON att.attrelid = fcl.oid AND att.attnum = u.attnum
    ),
    'on_delete', CASE con.confdeltype
      WHEN 'a' THEN 'NO ACTION' WHEN 'r' THEN 'RESTRICT'
      WHEN 'c' THEN 'CASCADE' WHEN 'n' THEN 'SET NULL'
      WHEN 'd' THEN 'SET DEFAULT' END,
    'on_update', CASE con.confupdtype
      WHEN 'a' THEN 'NO ACTION' WHEN 'r' THEN 'RESTRICT'
      WHEN 'c' THEN 'CASCADE' WHEN 'n' THEN 'SET NULL'
      WHEN 'd' THEN 'SET DEFAULT' END
  ) ORDER BY cl.relname, con.conname), '[]'::jsonb)
  FROM pg_constraint con
  JOIN pg_class cl ON cl.oid = con.conrelid
  JOIN pg_namespace n ON n.oid = cl.relnamespace
  JOIN pg_class fcl ON fcl.oid = con.confrelid
  WHERE n.nspname = 'public' AND con.contype = 'f';
$$;

REVOKE EXECUTE ON FUNCTION public.backup_get_tables() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.backup_get_functions() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.backup_get_triggers() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.backup_get_policies() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.backup_get_indexes() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.backup_get_foreign_keys() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.backup_get_tables() TO service_role;
GRANT EXECUTE ON FUNCTION public.backup_get_functions() TO service_role;
GRANT EXECUTE ON FUNCTION public.backup_get_triggers() TO service_role;
GRANT EXECUTE ON FUNCTION public.backup_get_policies() TO service_role;
GRANT EXECUTE ON FUNCTION public.backup_get_indexes() TO service_role;
GRANT EXECUTE ON FUNCTION public.backup_get_foreign_keys() TO service_role;