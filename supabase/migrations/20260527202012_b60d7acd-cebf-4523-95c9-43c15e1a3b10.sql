DROP POLICY IF EXISTS "Service inserts backup_runs" ON public.backup_runs;

CREATE POLICY "Authenticated admins insert backup_runs"
ON public.backup_runs FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND public.is_profile_admin(auth.uid())
);