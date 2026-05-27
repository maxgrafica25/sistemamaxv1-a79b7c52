-- =====================================================================
-- Migration G — P0 Security Hardening
-- =====================================================================

-- 1) Privatize maintenance-attachments bucket
UPDATE storage.buckets
   SET public = false
 WHERE id = 'maintenance-attachments';

-- 2) Recreate SELECT policies on storage.objects for that bucket (auth only)
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname
      FROM pg_policies
     WHERE schemaname = 'storage'
       AND tablename  = 'objects'
       AND (qual ILIKE '%maintenance-attachments%' OR with_check ILIKE '%maintenance-attachments%')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "maintenance-attachments authenticated read"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'maintenance-attachments');

CREATE POLICY "maintenance-attachments authenticated insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'maintenance-attachments');

CREATE POLICY "maintenance-attachments authenticated update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'maintenance-attachments')
WITH CHECK (bucket_id = 'maintenance-attachments');

CREATE POLICY "maintenance-attachments authenticated delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'maintenance-attachments');

-- 3) Harden quote_approval_receipts SELECT
--    - Drop any leftover anon SELECT policy
--    - Replace `USING (true)` authenticated SELECT with tenant-scoped check
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname
      FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename  = 'quote_approval_receipts'
       AND cmd = 'SELECT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.quote_approval_receipts', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "Authenticated can read receipts of own tenant"
ON public.quote_approval_receipts FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.quotes q
     WHERE q.id = quote_approval_receipts.quote_id
       AND q.empresa_id = public.current_empresa_id()
  )
);

-- Ensure anon has no SELECT grant on this table (defense in depth)
REVOKE SELECT ON public.quote_approval_receipts FROM anon;

-- 4) Lock down backup_* RPCs to service_role only
REVOKE EXECUTE ON FUNCTION public.backup_get_cron_jobs()             FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.backup_get_realtime_publication()  FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.backup_get_cron_jobs()             TO service_role;
GRANT  EXECUTE ON FUNCTION public.backup_get_realtime_publication()  TO service_role;