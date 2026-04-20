CREATE TABLE public.admin_operations_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  function_name text NOT NULL,
  operation text NOT NULL,
  target_table text,
  target_count integer DEFAULT 0,
  invoked_by uuid,
  metadata jsonb DEFAULT '{}'::jsonb
);

CREATE INDEX idx_admin_ops_log_created_fn ON public.admin_operations_log (created_at DESC, function_name);

ALTER TABLE public.admin_operations_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view admin_operations_log"
  ON public.admin_operations_log FOR SELECT
  TO authenticated
  USING (public.is_profile_admin(auth.uid()));

CREATE POLICY "Service role can insert admin_operations_log"
  ON public.admin_operations_log FOR INSERT
  TO authenticated
  WITH CHECK (true);
